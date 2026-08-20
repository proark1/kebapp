type BrandMarkProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <span className={`brand-mark ${inverse ? "brand-mark--inverse" : ""}`}>
      <span className="brand-mark__symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {compact ? null : <span className="brand-mark__word">kebapp</span>}
    </span>
  );
}
