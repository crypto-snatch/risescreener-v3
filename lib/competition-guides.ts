// Hand-kept extras for competitions whose rules RISEx publishes as cards rather
// than through the API. Keyed by the competition slug from /v1/competitions.
// The wording follows the official cards; the images are RISEx's own.

export interface GuideImage { src: string; alt: string; width: number; height: number }
export interface GuideRule { label: string; text: string }
export interface CompetitionGuide { title: string; images: GuideImage[]; rules: GuideRule[] }

export const COMPETITION_GUIDES: Record<string, CompetitionGuide> = {
  perpkin: {
    title: "The recipe",
    images: [
      {
        src: "/events/perpkin-recipe.webp",
        alt: "Perpkin Spice Season recipe card: score is your share of volume, OI and PnL divided by 3 and multiplied by 10; rewards are your score over all eligible scores times $50,000.",
        width: 1200,
        height: 675,
      },
      {
        src: "/events/perpkin-prize.webp",
        alt: "Perpkin Spice Season prize card: $50K USDC and a mystery prize; OI is time-weighted, PnL counts realized profit, paid in USDC within 7 days, all RISEx markets count.",
        width: 1200,
        height: 675,
      },
    ],
    rules: [
      {
        label: "Score",
        text: "(your % of volume + your % of OI + your % of PnL) ÷ 3 × 10. All scores add up to 1,000, so a score of 11 is 1.1% of the total.",
      },
      {
        label: "Rewards",
        text: "Your score ÷ all eligible scores × $50,000.",
      },
      {
        label: "Eligibility",
        text: "$100K+ in volume and $10+ in rewards. Scores that miss eligibility are re-split among eligible wallets, so the full $50,000 is always paid.",
      },
      {
        label: "Fine print",
        text: "OI is time-weighted. PnL counts realized profit. Paid in USDC within 7 days. All markets on RISEx count.",
      },
    ],
  },
};
