/**
 * Product-level feature switches for the editor.
 *
 * Keep disabled implementations behind these switches so they can be evaluated
 * again without exposing unfinished controls in the shipped interface.
 */
export const EDITOR_FEATURES: Readonly<{
  imageVectorization: boolean;
  tableLayer: boolean;
}> = Object.freeze({
  imageVectorization: false,
  tableLayer: true,
});
