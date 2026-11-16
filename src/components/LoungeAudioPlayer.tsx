import { useEffect, useRef, useState } from 'react';
import { Disc3, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { BorderBeam } from './ui/border-beam';

interface LoungeTrack {
  id: string;
  title: string;
  artist: string;
  vibe: string;
  durationSeconds: number;
  chords: number[][];
  bpmMs: number;
  gradientClass: string;
}

const LOUNGE_TRACKS: LoungeTrack[] = [
  {
    id: 'haskell-midnight',
    title: 'Haskell Ave Midnight',
    artist: 'Xecutive Lounge Quartet',
    vibe: 'Warm Rhodes & Neo-Soul Groove',
    durationSeconds: 218,
    // Dm9 -> G13 -> Cmaj9 -> A7alt jazz voicings
    chords: [
      [293.66, 349.23, 440.0, 523.25],
      [196.0, 329.63, 440.0, 493.88],
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 329.63, 392.0, 466.16],
    ],
    bpmMs: 1650,
    gradientClass: 'from-[#E9B84B] via-[#8F651D] to-[#1A1610]',
  },
  {
    id: 'velvet-fade',
    title: 'Velvet Fade Session',
    artist: 'Dallas Vinyl Collective',
    vibe: 'Chill Lo-Fi Jazz Lounge',
    durationSeconds: 194,
    // Fm9 -> Bb13 -> Ebmaj9 -> C7
    chords: [
      [174.61, 261.63, 311.13, 392.0],
      [233.08, 293.66, 349.23, 440.0],
      [155.56, 233.08, 293.66, 392.0],
      [196.0, 261.63, 329.63, 466.16],
    ],
    bpmMs: 1850,
    gradientClass: 'from-[#F5F2EA]/75 via-[#C99B3C] to-[#1C1B18]',
  },
  {
    id: 'uptown-espresso',
    title: 'Uptown Espresso & Tonic',
    artist: 'East Dallas Soul Trio',
    vibe: 'Smooth Acoustic Rhodes',
    durationSeconds: 242,
    // Am9 -> D9 -> Gmaj9 -> E7sus4
    chords: [
      [220.0, 261.63, 329.63, 493.88],
      [293.66, 369.99, 440.0, 523.25],
      [196.0, 293.66, 369.99, 440.0],
      [164.81, 246.94, 329.63, 440.0],
    ],
    bpmMs: 1550,
    gradientClass: 'from-[#C99B3C] via-[#5C4115] to-[#0B0B0B]',
  },
];

function formatTrackTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function LoungeAudioPlayer() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(52);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const chordTimerRef = useRef<number | null>(null);
  const chordStepRef = useRef(0);

  const track = LOUNGE_TRACKS[trackIndex];
  const progressPct = Math.min(100, (elapsed / track.durationSeconds) * 100);

  const stopAudioEngine = () => {
    if (chordTimerRef.current !== null) {
      window.clearInterval(chordTimerRef.current);
      chordTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const playWarmChord = (ctx: AudioContext, freqs: number[]) => {
    if (isMuted) return;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.055, now + 0.16);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
    masterGain.connect(ctx.destination);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      osc.connect(masterGain);
      osc.start(now + idx * 0.035);
      osc.stop(now + 1.5);
    });
  };

  useEffect(() => {
    if (!isPlaying) {
      stopAudioEngine();
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      chordStepRef.current = 0;
      playWarmChord(ctx, track.chords[0]);

      chordTimerRef.current = window.setInterval(() => {
        if (!audioCtxRef.current) return;
        chordStepRef.current = (chordStepRef.current + 1) % track.chords.length;
        playWarmChord(audioCtxRef.current, track.chords[chordStepRef.current]);
      }, track.bpmMs);
    }

    const tickTimer = window.setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= track.durationSeconds) {
          setTrackIndex((idx) => (idx + 1) % LOUNGE_TRACKS.length);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(tickTimer);
      stopAudioEngine();
    };
  }, [isPlaying, trackIndex, isMuted]);

  useEffect(() => {
    return () => stopAudioEngine();
  }, []);

  const handlePrev = () => {
    setTrackIndex((prev) => (prev - 1 + LOUNGE_TRACKS.length) % LOUNGE_TRACKS.length);
    setElapsed(0);
  };

  const handleNext = () => {
    setTrackIndex((prev) => (prev + 1) % LOUNGE_TRACKS.length);
    setElapsed(0);
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <Card className="relative w-full max-w-[380px] overflow-hidden bg-[#141414]/95 border-[rgba(218,174,77,0.28)] shadow-[0_24px_55px_-20px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#E9B84B]">
            {isPlaying ? 'Now Playing · In-Shop Vibe' : 'Lounge Soundtrack'}
          </span>
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Unmute lounge audio' : 'Mute lounge audio'}
            className="p-1.5 text-[#A5A29B] hover:text-[#E9B84B] transition-colors rounded-sm cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
        <CardTitle className="text-2xl text-[#F5F2EA] pt-1">{track.title}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-[#A5A29B]">
          {track.artist} · {track.vibe}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div
            className={`relative h-44 w-44 rounded-sm bg-gradient-to-br ${track.gradientClass} border border-[rgba(218,174,77,0.35)] flex items-center justify-center shadow-inner overflow-hidden`}
          >
            <div className="absolute inset-3 rounded-full border border-[#F5F2EA]/15" />
            <div className="absolute inset-7 rounded-full border border-[#0B0B0B]/35" />
            <Disc3
              className={`w-14 h-14 text-[#0B0B0B]/85 transition-transform duration-500 ${
                isPlaying ? 'animate-spin' : ''
              }`}
              style={isPlaying ? { animationDuration: '5s' } : undefined}
            />
          </div>

          <div
            role="slider"
            aria-label="Track progress"
            aria-valuemin={0}
            aria-valuemax={track.durationSeconds}
            aria-valuenow={elapsed}
            tabIndex={0}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setElapsed(Math.round(ratio * track.durationSeconds));
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setElapsed((s) => Math.min(track.durationSeconds, s + 10));
              if (e.key === 'ArrowLeft') setElapsed((s) => Math.max(0, s - 10));
            }}
            className="w-full h-1.5 bg-[#1C1B18] rounded-full overflow-hidden cursor-pointer border border-[rgba(218,174,77,0.16)]"
          >
            <div
              className="h-full bg-gradient-to-r from-[#C99B3C] to-[#E9B84B] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex w-full justify-between text-xs text-[#A5A29B] font-mono tabular-nums">
            <span>{formatTrackTime(elapsed)}</span>
            <span>{formatTrackTime(track.durationSeconds)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-center gap-4 pb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrev}
          aria-label="Previous lounge track"
          className="rounded-full"
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          size="icon"
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Pause lounge audio' : 'Play lounge audio'}
          className="rounded-full h-11 w-11"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          aria-label="Next lounge track"
          className="rounded-full"
        >
          <SkipForward className="size-4" />
        </Button>
      </CardFooter>

      <BorderBeam
        duration={6}
        size={340}
        borderWidth={2}
        className="from-transparent via-[#E9B84B] to-transparent"
      />
      <BorderBeam
        duration={6}
        delay={3}
        size={340}
        borderWidth={2}
        className="from-transparent via-[#F5F2EA]/80 to-transparent"
      />
    </Card>
  );
}
