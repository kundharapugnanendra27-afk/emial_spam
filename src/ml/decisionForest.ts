import { ExtractedFeatures, STRUCTURAL_FEATURE_NAMES } from './types';

interface TreeNode {
  isLeaf: boolean;
  probability: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function giniImpurity(posCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  const p = posCount / totalCount;
  return 2 * p * (1 - p);
}

// Deterministic PRNG (Mulberry32) so training & tests are 100% reproducible
function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DecisionForestModel {
  private trees: TreeNode[] = [];
  private readonly numTrees: number;
  private readonly maxDepth: number;

  constructor(numTrees = 25, maxDepth = 3) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
  }

  public fit(samples: { features: ExtractedFeatures; label: 'phishing' | 'legitimate' }[]): void {
    this.trees = [];
    if (samples.length === 0) return;

    const rng = createSeededRng(20261118);
    const numFeatures = STRUCTURAL_FEATURE_NAMES.length;
    const featureSubsetSize = Math.max(4, Math.floor(Math.sqrt(numFeatures)) + 2);

    const rows = samples.map((s) => ({
      x: s.features.structuralArray,
      y: s.label === 'phishing' ? 1 : 0,
    }));

    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sample
      const bootstrap: { x: number[]; y: number }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const idx = Math.floor(rng() * rows.length);
        bootstrap.push(rows[idx]);
      }

      const tree = this.buildTree(bootstrap, 0, featureSubsetSize, numFeatures, rng);
      this.trees.push(tree);
    }
  }

  private buildTree(
    rows: { x: number[]; y: number }[],
    depth: number,
    featureSubsetSize: number,
    numFeatures: number,
    rng: () => number
  ): TreeNode {
    let posCount = 0;
    for (const r of rows) posCount += r.y;
    const prob = rows.length > 0 ? (posCount + 0.5) / (rows.length + 1) : 0.5;

    if (depth >= this.maxDepth || rows.length < 4 || posCount === 0 || posCount === rows.length) {
      return { isLeaf: true, probability: prob };
    }

    // Sample candidate features without replacement
    const indices = Array.from({ length: numFeatures }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const candidateFeatures = indices.slice(0, featureSubsetSize);

    const parentGini = giniImpurity(posCount, rows.length);
    let bestGain = 0;
    let bestFeature = -1;
    let bestThreshold = 0.5;
    let bestLeft: { x: number[]; y: number }[] = [];
    let bestRight: { x: number[]; y: number }[] = [];

    const thresholds = [0.1, 0.25, 0.4, 0.5, 0.75];

    for (const fIdx of candidateFeatures) {
      for (const th of thresholds) {
        const left: { x: number[]; y: number }[] = [];
        const right: { x: number[]; y: number }[] = [];
        let leftPos = 0;
        let rightPos = 0;

        for (const r of rows) {
          if (r.x[fIdx] <= th) {
            left.push(r);
            leftPos += r.y;
          } else {
            right.push(r);
            rightPos += r.y;
          }
        }

        if (left.length < 2 || right.length < 2) continue;

        const weightedGini =
          (left.length / rows.length) * giniImpurity(leftPos, left.length) +
          (right.length / rows.length) * giniImpurity(rightPos, right.length);
        const gain = parentGini - weightedGini;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = fIdx;
          bestThreshold = th;
          bestLeft = left;
          bestRight = right;
        }
      }
    }

    if (bestFeature === -1 || bestGain < 0.005) {
      return { isLeaf: true, probability: prob };
    }

    return {
      isLeaf: false,
      probability: prob,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      left: this.buildTree(bestLeft, depth + 1, featureSubsetSize, numFeatures, rng),
      right: this.buildTree(bestRight, depth + 1, featureSubsetSize, numFeatures, rng),
    };
  }

  private predictTree(node: TreeNode, x: number[]): number {
    if (node.isLeaf || node.featureIndex === undefined || node.threshold === undefined) {
      return node.probability;
    }
    if (x[node.featureIndex] <= node.threshold) {
      return node.left ? this.predictTree(node.left, x) : node.probability;
    }
    return node.right ? this.predictTree(node.right, x) : node.probability;
  }

  public predict(features: ExtractedFeatures): number {
    if (this.trees.length === 0) return 0.5;
    let sum = 0;
    for (const tree of this.trees) {
      sum += this.predictTree(tree, features.structuralArray);
    }
    return sum / this.trees.length;
  }
}
