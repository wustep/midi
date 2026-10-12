/**
 * MPE (MIDI Polyphonic Expression) state tracking: zones from the MPE Configuration Message, and
 * per-note pitch (note + channel pitch bend), pressure (channel pressure) and timbre (CC 74).
 * Follows the MIDI Association's MPE specification: lower zone managed on channel 1 with member
 * channels counting up, upper zone managed on channel 16 with member channels counting down.
 */

export interface Zone {
  /** 0 = channel 1 (lower zone), 15 = channel 16 (upper zone). */
  manager: number;
  /** Member channel indexes (0-based). */
  members: number[];
  /** Pitch bend range of member channels, semitones (default 48). */
  memberBendRange: number;
  /** Pitch bend range of the manager channel, semitones (default 2). */
  managerBendRange: number;
}

export interface MpeNote {
  id: number;
  channel: number;
  note: number;
  velocity: number;
  /** Continuous pitch in semitones (MIDI note number + bends). */
  pitch: number;
  /** Channel pressure 0–1. */
  pressure: number;
  /** CC 74, 0–1 (0.5 = neutral). */
  timbre: number;
  releaseVelocity?: number;
  released: boolean;
  start: number;
}

export function zoneMembers(manager: number, count: number): number[] {
  const n = Math.max(0, Math.min(15, count));
  return manager === 0 ? Array.from({ length: n }, (_, i) => 1 + i) : Array.from({ length: n }, (_, i) => 14 - i);
}

/** The bytes of an MPE Configuration Message (RPN 6) for a zone, followed by the null RPN. */
export function mcmBytes(lower: boolean, memberChannels: number): number[] {
  const s = 0xb0 | (lower ? 0 : 15);
  return [s, 101, 0, s, 100, 6, s, 6, memberChannels & 0x7f, s, 101, 127, s, 100, 127];
}

/** Tracks MPE zones and active notes from a stream of MIDI messages. */
export class MpeState {
  zones: Zone[] = [];
  notes = new Map<number, MpeNote>();
  private bend = new Array(16).fill(0); // −1 … +1
  private pressure = new Array(16).fill(0);
  private timbre = new Array(16).fill(0.5);
  private rpn = Array.from({ length: 16 }, () => [127, 127] as [number, number]);
  private bendRange = new Array(16).fill(2);
  private nextId = 1;
  /** Assume a 15-member lower zone until an MCM says otherwise (what most MPE controllers send). */
  constructor(defaultZone = true) {
    if (defaultZone) this.configure(0, 15);
  }

  /** Apply an MPE Configuration Message for the zone managed on `manager` (0 or 15). */
  configure(manager: number, count: number) {
    const members = zoneMembers(manager, count);
    // A new zone takes channels away from the other one.
    this.zones = this.zones.filter((z) => z.manager !== manager && !members.includes(z.manager)).map((z) => ({ ...z, members: z.members.filter((c) => !members.includes(c) && c !== manager) })).filter((z) => z.members.length);
    if (members.length) {
      this.zones.push({ manager, members, memberBendRange: 48, managerBendRange: 2 });
      for (const c of members) this.bendRange[c] = 48;
      this.bendRange[manager] = 2;
    }
    this.zones.sort((a, b) => a.manager - b.manager);
  }

  zoneOf(channel: number): Zone | undefined {
    return this.zones.find((z) => z.manager === channel || z.members.includes(channel));
  }

  private refresh(channel: number) {
    const zone = this.zoneOf(channel);
    for (const n of this.notes.values()) {
      if (n.channel !== channel && !(zone && zone.manager === channel && zone.members.includes(n.channel))) continue;
      const z = this.zoneOf(n.channel);
      const mgr = z ? this.bend[z.manager] * this.bendRange[z.manager] : 0;
      n.pitch = n.note + this.bend[n.channel] * this.bendRange[n.channel] + (z && z.manager !== n.channel ? mgr : 0);
      if (n.channel === channel) {
        n.pressure = this.pressure[channel];
        n.timbre = this.timbre[channel];
      }
    }
  }

  /** Feed one MIDI message; returns the affected note, if any. */
  handle(data: ArrayLike<number>, time = 0): MpeNote | undefined {
    const [s, d1 = 0, d2 = 0] = Array.from(data);
    if (s < 0x80 || s >= 0xf0) return;
    const ch = s & 0x0f;
    switch (s & 0xf0) {
      case 0x90:
        if (d2 > 0) {
          // A new note on a channel replaces any note still sounding there.
          for (const [id, n] of this.notes) if (n.channel === ch && !n.released) this.notes.delete(id);
          const n: MpeNote = { id: this.nextId++, channel: ch, note: d1, velocity: d2, pitch: d1, pressure: this.pressure[ch], timbre: this.timbre[ch], released: false, start: time };
          this.notes.set(n.id, n);
          this.refresh(ch);
          return n;
        }
      // falls through
      case 0x80: {
        const n = [...this.notes.values()].find((x) => x.channel === ch && x.note === d1 && !x.released);
        if (n) {
          n.released = true;
          n.releaseVelocity = (s & 0xf0) === 0x80 ? d2 : 64;
        }
        return n;
      }
      case 0xe0:
        this.bend[ch] = ((((d2 << 7) | d1) - 8192) / 8192);
        this.refresh(ch);
        return;
      case 0xd0:
        this.pressure[ch] = d1 / 127;
        this.refresh(ch);
        return;
      case 0xa0: {
        // Poly pressure is allowed in MPE but rarely used; apply it to that note.
        const n = [...this.notes.values()].find((x) => x.channel === ch && x.note === d1 && !x.released);
        if (n) n.pressure = d2 / 127;
        return n;
      }
      case 0xb0:
        if (d1 === 74) {
          this.timbre[ch] = d2 / 127;
          this.refresh(ch);
        } else if (d1 === 101) this.rpn[ch][0] = d2;
        else if (d1 === 100) this.rpn[ch][1] = d2;
        else if (d1 === 6) {
          const [msb, lsb] = this.rpn[ch];
          if (msb === 0 && lsb === 6 && (ch === 0 || ch === 15)) this.configure(ch, d2);
          else if (msb === 0 && lsb === 0) {
            this.bendRange[ch] = d2;
            const z = this.zoneOf(ch);
            // Pitch bend range sent on a member channel applies to all members of the zone.
            if (z && z.members.includes(ch)) for (const c of z.members) this.bendRange[c] = d2;
            this.refresh(ch);
          }
        } else if (d1 === 123 || d1 === 120) for (const n of this.notes.values()) if (n.channel === ch || this.zoneOf(ch)?.manager === ch) n.released = true;
        return;
    }
  }

  /** Remove released notes older than `keep` ms (for drawing fade-outs). */
  prune(now: number, releasedAt: Map<number, number>, keep = 600) {
    for (const [id, n] of this.notes) {
      if (!n.released) continue;
      const t = releasedAt.get(id) ?? now;
      if (!releasedAt.has(id)) releasedAt.set(id, now);
      if (now - t > keep) {
        this.notes.delete(id);
        releasedAt.delete(id);
      }
    }
  }

  bendRangeOf(channel: number) {
    return this.bendRange[channel];
  }
}

/* ---------------- Simulator ---------------- */

export interface SimNote {
  channel: number;
  note: number;
  start: number;
  length: number;
  /** Semitone glide over the note's life. */
  glide: number;
  vibrato: number;
}

/**
 * Generate the MIDI messages of a gesture at time t (ms) for the playground's simulated mode:
 * notes with pressure swells, vibrato, glides and timbre sweeps on rotating member channels.
 */
export function simulateFrame(notes: SimNote[], t: number, bendRange = 48): number[][] {
  const out: number[][] = [];
  for (const n of notes) {
    const age = t - n.start;
    if (age < 0 || age > n.length) continue;
    const p = age / n.length;
    const semis = n.glide * Math.sin((p * Math.PI) / 2) + n.vibrato * Math.sin(age / 90) * Math.min(1, age / 400);
    const bend = Math.max(0, Math.min(16383, Math.round(8192 + (semis / bendRange) * 8192)));
    const pressure = Math.round(127 * Math.sin(Math.PI * p) ** 0.7);
    const timbre = Math.round(64 + 50 * Math.sin(p * Math.PI * 2 + n.note));
    out.push([0xe0 | n.channel, bend & 0x7f, bend >> 7], [0xd0 | n.channel, pressure], [0xb0 | n.channel, 74, Math.max(0, Math.min(127, timbre))]);
  }
  return out;
}
