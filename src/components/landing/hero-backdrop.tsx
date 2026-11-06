/**
 * DESIGN.md › Imagens: the landing hero's only "cinematic" moment — abstract
 * diagonal red shapes, heavily blurred, drifting slowly on the black ground.
 * Pure CSS (transform-only animation, see .hero-backdrop in globals.css);
 * still under prefers-reduced-motion. Never used on data screens.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="hero-backdrop">
      <span className="hero-shard hero-shard-a" />
      <span className="hero-shard hero-shard-b" />
      <span className="hero-shard hero-shard-c" />
      <span className="hero-grid" />
    </div>
  );
}
