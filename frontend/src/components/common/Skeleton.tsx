import { cx } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cx("skeleton", className)} style={style} aria-hidden="true" />;
}

/** Three placeholder rows used while a meeting list loads. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton skeleton--block"
          style={{ marginBottom: 14 }}
        />
      ))}
    </div>
  );
}
