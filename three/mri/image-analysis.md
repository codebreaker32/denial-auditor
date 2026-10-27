# Image analysis: MRI scanner (reference.jpg, "MRI-Philips" by Jan Ainali, CC BY 3.0)

Intended use: a stylized hero prop floating inside a glass bubble on the Denial Auditor deck and app hero
(Bubdle-style reference). Brand wordmark, model plate and the power-injector stand are deliberately
excluded: the result is a generic MRI scanner, not a reproduction of a branded product.

## 1. Identification
- Work type: closed-bore magnetic resonance imaging scanner (gantry + patient couch). Class: medical
  imaging equipment / furnishing-scale machine. primaryDomain: object. Confidence 0.95.

## 2. Form and silhouette
- Gantry: a thick torus-like ring (outer diameter ≈ 2.0 units, depth ≈ 1.6 units along the bore axis)
  whose outer silhouette is a rounded square-circle (superellipse) rather than a pure circle; flat-ish
  front face. Inferred: lofted superellipse shell with large fillets.
- Bore: a cylindrical through-hole ≈ 0.6 of the outer diameter, centred slightly above the gantry centre.
- Couch: a long extruded profile (≈ 2.4 units) along the bore axis, in front of the gantry, top surface at
  ≈ 0.42 of gantry height, on a tapered pedestal base.
- Gantry base: a recessed plinth band under the ring.
- Symmetry: bilateral about the vertical plane through the bore axis (ignoring the side console).

## 3. Decomposition
- macro: gantry-shell, bore-liner, front-cover-panel, couch-top, couch-pedestal, gantry-plinth.
- meso: front cover is an inset annulus (lighter cream) inside a thin rim of the outer shell (off-white);
  bore liner extends as a smaller inner tube with a flared lip; couch-top carries a cushion pad and a
  wedge pillow; couch rail lip runs the length of the couch; small display panel above the bore.
- micro: seam lines on the shell (shallow grooves), a vent grille on the lateral side, a small status
  display, label stickers (excluded), the pillow.

## 4. Spatial relationships
- <bore-liner, inside, gantry-shell> embed; <front-cover-panel, flush-with, gantry-shell front> inset 0.02.
- <couch-top, enters, bore-liner> overlap along the bore axis; <couch-top, above, couch-pedestal> butt.
- <gantry-shell, above, gantry-plinth> butt; <display-panel, embedded-in, front-cover-panel> above bore.

## 5. Materials (PBR)
- Shell: dielectric plastic, albedo off-white (value ~0.88, slight warm), roughness ~0.45, metalness 0.
- Front cover: dielectric plastic, albedo pale cream (value ~0.85, warmer), roughness ~0.5.
- Bore liner: same cream, roughness 0.4; interior occluded/shadowed (inference: lit interior).
- Couch: plastic off-white, pad a pale yellow vinyl roughness 0.6; plinth light grey satin metal trim
  (metalness 0.3, roughness 0.35).
- Observation: warm cast across the image is from the room lighting (baked), not albedo.

## 6. Colour and finish
- Off-white #EDEAE4 shell, cream #F2E6CF front cover, pale yellow pad #EFE3B8, grey trim #B9BCC0. Satin finish.

## 7. Identity features
- The ring gantry with a deep bore (the defining read of "MRI").
- The couch entering the bore.
- Inset lighter front cover inside the outer shell rim.
- Rounded-square outer silhouette and plinth.

## 8. Uncertainty
- Rear of gantry hidden (assume symmetric, bore exits rear). Interior of bore occluded beyond depth ≈ 0.5.
- The upper column/duct going into the ceiling is part of the room (excluded).
- Exact depth of the gantry undetermined (estimate from perspective: ≈ 0.8 × outer diameter).
- Stylization is intended: low-poly-smooth "toy" read for a glass-bubble hero, not a measured replica.
