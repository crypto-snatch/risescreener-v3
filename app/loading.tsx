export default function Loading() {
  return (
    <div className="atlas-loading" role="status" aria-label="Loading live market data">
      <div className="loading-title">
        <span />
        <i />
      </div>
      <div className="loading-kpis">
        {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
      </div>
      <div className="loading-charts">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
