import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconArrowRight, IconX } from "./icons.jsx";

const SWIPE_THRESHOLD = 40;

export default function PhotoLightbox({ photos, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef(null);

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photos.length, onClose]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > SWIPE_THRESHOLD) prev();
    else if (delta < -SWIPE_THRESHOLD) next();
    touchStartX.current = null;
  };

  return (
    <div className="photo-lightbox-backdrop" onClick={onClose}>
      <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label="Close">
        <IconX />
      </button>

      {photos.length > 1 && (
        <button
          type="button"
          className="photo-lightbox-arrow photo-lightbox-arrow-prev"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Previous photo"
        >
          <IconArrowLeft />
        </button>
      )}

      <img
        className="photo-lightbox-image"
        src={photos[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {photos.length > 1 && (
        <button
          type="button"
          className="photo-lightbox-arrow photo-lightbox-arrow-next"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Next photo"
        >
          <IconArrowRight />
        </button>
      )}

      {photos.length > 1 && (
        <div className="photo-lightbox-counter">{index + 1} / {photos.length}</div>
      )}
    </div>
  );
}
