# Coding Standards

## 1. General Principles (Ponytail)
- Keep code minimal and straight-to-the-point. Avoid over-engineering (YAGNI).
- Prefer native standard libraries over external packages unless required.
- Maintain strict safety, clean error handling, and performance.

## 2. GSAP Animation Rules
- **GSAP 3 Syntax Only**: Always use modern GSAP 3 API (`gsap.to()`, `gsap.from()`, `gsap.fromTo()`, `gsap.timeline()`). NEVER use legacy `TweenMax`, `TweenLite`, or `TimelineMax`.
- **String Ease Syntax**: Use string-based eases like `ease: "power2.out"` or `"back.out(1.7)"` instead of `Power2.easeOut`.
- **Transforms**: Prefer `x`, `y`, `xPercent`, `yPercent`, `scale`, `rotation` over CSS left/top/transform properties for optimal GPU performance.
- **Framework Cleanup**:
  - In React, use `@gsap/react` (`useGSAP()`) or `gsap.context()` inside `useEffect` to ensure proper animation cleanup.
  - In Vue/Svelte, revert or kill animations on component unmount.
- **ScrollTrigger**: Register plugins explicitly (`gsap.registerPlugin(ScrollTrigger)`) and clean up triggers on component unmount.