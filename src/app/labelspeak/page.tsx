"use client";

import { Fragment, useState } from "react";
import { toJpegBase64 } from "@/lib/image";
import { LANGUAGES, speak, pauseSpeech, resumeSpeech, stopSpeech } from "@/lib/speech";
import { Icon } from "@/components/ui/Icon";
import { Waveform } from "@/components/ui/Waveform";

interface Field {
  original: string;
  translated: string;
}
interface LabelResult {
  readable: boolean;
  medicineName: Field;
  strength: Field;
  howToTake: Field;
  warnings: Field[];
  expiry: string;
  unclearParts: string[];
  readAloud: string;
}

interface ImageData {
  id: string;
  preview: string;
  imageBase64: string;
  result: LabelResult | null;
  resultLang: string;
  error: string;
  busy: boolean;
  audioPlaying: boolean;
}

const MAX_BYTES = 4_500_000;

export default function LabelSpeakPage() {
  const [language, setLanguage] = useState<string>("Chinese (Simplified)");
  const [images, setImages] = useState<ImageData[]>([]);
  const [nextId, setNextId] = useState(0);

  const translate = async (id: string, imageBase64: string, lang: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, busy: true, error: "" } : img)));
    try {
      const res = await fetch("/api/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: "image/jpeg", language: lang }),
      });
      const out = await res.json();
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? { ...img, busy: false, ...(res.ok ? { result: out, resultLang: lang } : { error: out.error ?? "Couldn't read the label." }) }
            : img
        )
      );
    } catch {
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, busy: false, error: "Couldn't process that image. Try a different photo." } : img)));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const id = String(nextId);
    setNextId(nextId + 1);
    setImages([...images, { id, preview: URL.createObjectURL(file), imageBase64: "", result: null, resultLang: language, error: "", busy: true, audioPlaying: false }]);

    try {
      const imageBase64 = await toJpegBase64(file);
      if (imageBase64.length > MAX_BYTES) throw new Error("Image too large");
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, imageBase64 } : img)));
      await translate(id, imageBase64, language);
    } catch {
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, busy: false, error: "Couldn't process that image. Try a different photo." } : img)));
    }
  };

  const onLanguageChange = (lang: string) => {
    setLanguage(lang);
    stopSpeech();
    setImages((prev) => prev.map((img) => ({ ...img, audioPlaying: false })));
    images.forEach((img) => {
      if (img.imageBase64 && img.result && img.resultLang !== lang) translate(img.id, img.imageBase64, lang);
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const updateAudio = (id: string, playing: boolean) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, audioPlaying: playing } : img)));
  };

  const row = (label: string, f: Field) => (
    <tr className="border-b border-line align-top">
      <th className="py-2 pr-3 text-left text-xs font-semibold text-muted">{label}</th>
      <td className="py-2 pr-3">{f.original || <span className="text-warn">unclear</span>}</td>
      <td className="py-2">{f.translated}</td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-accent-text">LabelSpeak</h1>
        <p className="text-muted">
          Photograph medicine labels. We read, translate, and read aloud — so you can follow instructions in your language.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="ls-lang">Translate into</label>
            <select id="ls-lang" className="input" value={language} onChange={(e) => onLanguageChange(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.name}>{l.name}</option>)}
            </select>
          </div>
          <label className="btn-primary cursor-pointer flex items-center justify-center gap-2">
            <Icon name="camera" className="h-5 w-5" /> Take or upload photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
        <div className="rounded-lg bg-warn-soft border border-warn-line px-4 py-3 text-sm text-warn">
          <p className="font-semibold mb-1">Always check with your pharmacist.</p>
          <p>LabelSpeak reads what is printed — it never guesses a dose.</p>
        </div>
      </div>

      {images.length === 0 && (
        <div className="text-center py-12">
          <p className="text-faint text-lg">No photos yet. Take or upload one to get started.</p>
        </div>
      )}

      <div className="space-y-6">
        {images.map((img) => (
          <div key={img.id} className="card space-y-4">
            {/* Header with remove button */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
              <h3 className="font-semibold text-accent-text">Medicine label</h3>
              <button className="btn-danger p-2 text-lg" onClick={() => removeImage(img.id)} title="Remove">
                ✕
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.preview} alt="Photo of the medicine label you uploaded" className="max-h-64 w-auto rounded-lg border border-line object-contain" />

            {/* Loading state */}
            {img.busy && (
              <div className="flex items-center gap-2 text-muted">
                <span className="animate-spin text-accent-text"><Icon name="loader" className="h-6 w-6" /></span>
                <span>Reading label…</span>
              </div>
            )}

            {/* Error state */}
            {img.error && <p className="rounded-lg bg-bad-soft border border-warn-line p-3 text-bad">{img.error}</p>}

            {/* Result */}
            {img.result && (
              <>
                {!img.result.readable ? (
                  <p className="text-muted">This doesn&apos;t look like a medicine label. Try again with the label filling the photo.</p>
                ) : (
                  <>
                    {/* Two-panel design */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Original */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-accent-text text-sm">On the label</h4>
                        <div className="space-y-3">
                          {[
                            { label: "Medicine", field: img.result.medicineName },
                            { label: "Strength", field: img.result.strength },
                            { label: "How to take", field: img.result.howToTake },
                          ].map(({ label, field }) => (
                            <div key={label} className="space-y-1">
                              <p className="text-xs font-semibold text-faint uppercase">{label}</p>
                              <p className="text-sm text-ink">{field.original || <span className="text-bad">unclear</span>}</p>
                            </div>
                          ))}
                          {img.result.warnings.map((w, i) => (
                            <div key={i} className="space-y-1">
                              <p className="text-xs font-semibold text-faint uppercase">Warning {i + 1}</p>
                              <p className="text-sm text-ink">{w.original}</p>
                            </div>
                          ))}
                          {img.result.expiry && <p className="text-sm text-muted"><span className="font-semibold">Expiry:</span> {img.result.expiry}</p>}
                        </div>
                      </div>

                      {/* Translation */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-accent-text text-sm">In {img.resultLang}</h4>
                        <div className="space-y-3">
                          {[
                            { label: "Medicine", field: img.result.medicineName },
                            { label: "Strength", field: img.result.strength },
                            { label: "How to take", field: img.result.howToTake },
                          ].map(({ label, field }) => (
                            <div key={label} className="space-y-1">
                              <p className="text-xs font-semibold text-faint uppercase">{label}</p>
                              <p className="text-sm font-medium text-ink">{field.translated}</p>
                            </div>
                          ))}
                          {img.result.warnings.map((w, i) => (
                            <div key={i} className="space-y-1">
                              <p className="text-xs font-semibold text-faint uppercase">Warning {i + 1}</p>
                              <p className="text-sm font-medium text-ink">{w.translated}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Unclear parts warning */}
                    {img.result.unclearParts.length > 0 && (
                      <div className="rounded-lg bg-warn-soft border border-warn-line p-3 text-warn text-sm">
                        <p className="font-semibold">Couldn&apos;t read:</p>
                        <p>{img.result.unclearParts.join(", ")}. Ask your pharmacist.</p>
                      </div>
                    )}

                    {/* Read aloud button */}
                    <div className="pt-3 border-t border-line">
                      {!img.audioPlaying ? (
                        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => { img.result && speak(img.result.readAloud, img.resultLang); updateAudio(img.id, true); }}>
                          <Icon name="volume" className="h-5 w-5" /> Read aloud in {img.resultLang}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Waveform active />
                          <button className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={() => { pauseSpeech(); updateAudio(img.id, false); }}>
                            <Icon name="pause" className="h-5 w-5" /> Pause
                          </button>
                          <button className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={() => { resumeSpeech(); updateAudio(img.id, true); }}>
                            <Icon name="play" className="h-5 w-5" /> Resume
                          </button>
                          <button className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={() => { stopSpeech(); updateAudio(img.id, false); }}>
                            <Icon name="stop" className="h-5 w-5" /> Stop
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
