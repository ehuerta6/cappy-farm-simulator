# Approved Cappy character

The [approved character sheet](CAPPY_CHARACTER_SHEET.png) supplied by the project owner is the visual source of truth. Match this character rather than redesigning it: a neckless capybara with a large pear-shaped belly, broad projecting muzzle, tiny dark eyes, short limbs, paw-like feet, subtle rounded tail, and a broad straw hat with a reddish brown band.

[Implementation comparison](CAPPY_MODEL_COMPARISON.png) shows the procedural model beside the sheet from front, three-quarter, side, and back. The model uses a continuous shaped torso with integrated lighter belly coloring, shaped skull/snout/nose meshes, and independent animation pivots. The fixed gameplay camera remains the primary readability check.

The reference's stylized proportions and animation poses guide `src/cappy-model.ts`. Grid coordinates, gameplay API, Python runtime, and objective logic are independent of this model. Tests verify dominant belly proportions, feet tucked beneath the body, grounded feet while planting, and neutral-pose recovery after any action or cancellation.
