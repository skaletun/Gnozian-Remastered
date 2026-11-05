# Low-poly art production

All handcrafted 3D models must retain their editable Blockbench .bbmodel source. Export individual assets as glTF 2.0 (.glb) and place exports under public/models/.

## Naming and scale
- 1 Babylon world unit = approximately 1 hex tile height scale.
- Origin centered on terrain; Y is up in Babylon.
- Prefer flat-colored materials with a small palette and no high-resolution textures.
- Triangle budgets: terrain < 100 per cell; city < 350; unit < 250; landmark < 700.
- Bundle common materials and avoid draw calls per prop when possible.
- Use LOD, instancing and asset batching for smartphones.
- Mobile performance targets: 30 fps on midrange phones, 60 fps on stronger devices.
- Do not delete .bbmodel sources after glTF exports.

The initial runtime primitives in src/render/BabylonWorld.ts are **temporary 3D geometry**, not finished art. Every original Gnozian visual element must be redesigned and replaced in later remaster milestones.
