/**
 * Logo de Tempo : le nom en mono très gras, suivi d'un curseur de terminal fixe.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span
      className="mono inline-flex items-baseline font-extrabold text-[var(--ink)]"
      style={{ fontSize: size, letterSpacing: "-0.045em", lineHeight: 1 }}
    >
      tempo
      <span
        aria-hidden
        className="inline-block"
        style={{
          width: "0.55em",
          height: "0.78em",
          marginLeft: "0.1em",
          transform: "translateY(0.1em)",
          background: "var(--accent)",
        }}
      />
    </span>
  );
}
