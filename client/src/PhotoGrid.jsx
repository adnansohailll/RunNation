// Facebook-style photo grid: 1/2/3-photo layouts sized generously, 4+ shown
// as a 2x2 grid with a "+N" overlay on the last tile for anything beyond 4.
export default function PhotoGrid({ photos, onOpen }) {
  if (!photos || photos.length === 0) return null;

  const visible = photos.slice(0, 4);
  const remaining = photos.length - visible.length;

  return (
    <div className={`comment-photo-grid comment-photo-grid-${visible.length}`}>
      {visible.map((url, i) => {
        const isLastWithMore = remaining > 0 && i === visible.length - 1;
        return (
          <button
            key={url + i}
            type="button"
            className="comment-photo-tile"
            onClick={() => onOpen(i)}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            <img src={url} alt="" loading="lazy" />
            {isLastWithMore && (
              <span className="comment-photo-grid-more">+{remaining}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
