function buildPageList(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_item, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const normalized = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const withGaps = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const page = normalized[i];
    const previous = normalized[i - 1];

    if (typeof previous === 'number' && page - previous > 1) {
      withGaps.push('...');
    }

    withGaps.push(page);
  }

  return withGaps;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = buildPageList(currentPage, totalPages);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className={`pagination-shell ${className}`.trim()}>
      <p className="pagination-meta">
        Página {currentPage} de {totalPages}
      </p>

      <button
        className="pagination-nav"
        disabled={!canGoPrevious}
        onClick={() => canGoPrevious && onPageChange(currentPage - 1)}
        type="button"
      >
        {'<'} Anterior
      </button>

      <div className="pagination-numbers">
        {pages.map((item, index) => {
          if (item === '...') {
            return (
              <span className="pagination-gap" key={`gap-${index}`}>
                ...
              </span>
            );
          }

          const page = Number(item);
          const active = page === currentPage;

          return (
            <button
              className={`pagination-number ${active ? 'pagination-number-active' : ''}`.trim()}
              key={`page-${page}`}
              onClick={() => onPageChange(page)}
              type="button"
            >
              {page}
            </button>
          );
        })}
      </div>

      <button
        className="pagination-nav"
        disabled={!canGoNext}
        onClick={() => canGoNext && onPageChange(currentPage + 1)}
        type="button"
      >
        Próxima {'>'}
      </button>
    </div>
  );
}
