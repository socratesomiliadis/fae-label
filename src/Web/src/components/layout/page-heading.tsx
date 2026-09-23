import React from "react";

export function Heading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
