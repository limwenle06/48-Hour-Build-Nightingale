import type { RiskLevel } from "../../contracts";

export interface DeterministicRiskRule {
  rule_id: string;
  risk_level: Exclude<RiskLevel, "low">;
  reason: string;
  patterns: readonly RegExp[];
}

export const HIGH_RISK_RULES: readonly DeterministicRiskRule[] = [
  {
    rule_id: "high_risk_chest_001",
    risk_level: "high",
    reason: "Potentially serious chest symptoms were reported.",
    patterns: [
      /\bchest\s+(?:pain|pressure|tightness|tight|heaviness)\b/i,
      /\b(?:pain|pressure|tightness)\s+in\s+(?:my|the)\s+chest\b/i,
      /\bcrushing\s+(?:pain|pressure)\b/i,
    ],
  },
  {
    rule_id: "high_risk_breathing_001",
    risk_level: "high",
    reason: "Serious breathing difficulty was reported.",
    patterns: [
      /\b(?:cannot|can't|unable\s+to|struggling\s+to|hard\s+to)\s+breathe\b/i,
      /\b(?:not|isn't|isnt)\s+breathing\b/i,
      /\b(?:gasping|fighting)\s+for\s+(?:air|breath)\b/i,
      /\b(?:severe|serious|sudden)\s+(?:shortness\s+of\s+breath|breathing\s+difficult(?:y|ies))\b/i,
    ],
  },
  {
    rule_id: "high_risk_bleeding_001",
    risk_level: "high",
    reason: "Heavy or uncontrolled bleeding was reported.",
    patterns: [
      /\b(?:heavy|severe|major|uncontrolled)\s+bleeding\b/i,
      /\bbleeding\s+(?:is\s+)?(?:heavy|severe|uncontrolled)\b/i,
      /\bbleeding\s+(?:heavily|a\s+lot|won't\s+stop|will\s+not\s+stop)\b/i,
      /\b(?:cannot|can't|unable\s+to)\s+stop\s+(?:the\s+)?bleeding\b/i,
      /\blosing\s+(?:a\s+lot\s+of|lots\s+of|too\s+much)\s+blood\b/i,
    ],
  },
  {
    rule_id: "high_risk_self_harm_001",
    risk_level: "high",
    reason: "Self-harm or suicide-related intent was reported.",
    patterns: [
      /\b(?:want|plan|planning|going|about)\s+to\s+(?:kill|hurt|harm)\s+(?:myself|me)\b/i,
      /\b(?:suicidal|suicide)\b/i,
      /\b(?:don't|do\s+not)\s+want\s+to\s+(?:live|be\s+alive)\b/i,
      /\bno\s+(?:reason|point)\s+to\s+live\b/i,
      /\bbetter\s+off\s+dead\b/i,
      /\bend\s+my\s+life\b/i,
    ],
  },
  {
    rule_id: "high_risk_stroke_001",
    risk_level: "high",
    reason: "Possible stroke warning signs were reported.",
    patterns: [
      /\bface\s+(?:is\s+)?droop(?:ing|ed)?\b/i,
      /\bslurred\s+speech\b/i,
      /\b(?:sudden|new)\s+(?:one[-\s]?sided\s+)?(?:weakness|numbness|paralysis)\b/i,
      /\b(?:weakness|numbness|paralysis)\s+(?:on|down)\s+one\s+side\b/i,
      /\b(?:cannot|can't|unable\s+to)\s+(?:raise|lift|move)\s+(?:my\s+)?(?:left|right|one)\s+arm\b/i,
      /\bsudden\s+(?:confusion|trouble\s+speaking|difficulty\s+speaking)\b/i,
    ],
  },
  {
    rule_id: "high_risk_consciousness_seizure_001",
    risk_level: "high",
    reason: "Loss of consciousness or an active seizure was reported.",
    patterns: [
      /\b(?:unconscious|unresponsive|not\s+responding)\b/i,
      /\b(?:won't|will\s+not|not)\s+wake\s+up\b/i,
      /\b(?:having|active|ongoing)\s+(?:a\s+)?seizure\b/i,
      /\bseizure\s+(?:won't|will\s+not|isn't|isnt)\s+stop(?:ping)?\b/i,
      /\bseizure\s+(?:lasting|for)\s+(?:more\s+than|over)\s+5\s+minutes\b/i,
    ],
  },
  {
    rule_id: "high_risk_allergic_reaction_001",
    risk_level: "high",
    reason: "A possible severe allergic reaction was reported.",
    patterns: [
      /\b(?:severe\s+)?allergic\s+reaction\b/i,
      /\b(?:anaphylaxis|anaphylactic)\b/i,
      /\b(?:tongue|throat|lips?|face)\s+(?:is\s+|are\s+)?swelling\b/i,
      /\bswelling\s+(?:of|in)\s+(?:my|the)\s+(?:tongue|throat|lips?|face)\b/i,
      /\bthroat\s+(?:is\s+)?clos(?:ing|ed)\b/i,
    ],
  },
  {
    rule_id: "high_risk_overdose_poisoning_001",
    risk_level: "high",
    reason: "A possible overdose or poisoning was reported.",
    patterns: [
      /\b(?:overdose|overdosed|poisoning|poisoned)\b/i,
      /\btook\s+(?:too\s+many|a\s+whole\s+bottle\s+of)\s+(?:pills?|tablets?|capsules?|medicines?|medications?)\b/i,
      /\b(?:swallowed|drank|ingested)\s+(?:poison|bleach|cleaning\s+fluid|chemicals?)\b/i,
    ],
  },
  {
    rule_id: "high_risk_choking_001",
    risk_level: "high",
    reason: "Choking or a blocked airway was reported.",
    patterns: [
      /\b(?:i(?:'m|\s+am)|is|are)\s+choking\b/i,
      /\bchoking\s+and\s+(?:cannot|can't|unable\s+to)\s+breathe\b/i,
      /\bairway\s+(?:is\s+)?blocked\b/i,
    ],
  },
];

export const MEDIUM_RISK_RULES: readonly DeterministicRiskRule[] = [
  {
    rule_id: "medium_risk_ambiguous_chest_001",
    risk_level: "medium",
    reason: "An unclear chest symptom needs clinical review.",
    patterns: [
      /\bchest\s+(?:feels?|is)\s+(?:funny|strange|weird|odd|unusual|not\s+right)\b/i,
    ],
  },
  {
    rule_id: "medium_risk_diagnosis_request_001",
    risk_level: "medium",
    reason: "The patient requested diagnosis or clinical interpretation.",
    patterns: [
      /\b(?:do|could|might)\s+i\s+have\b/i,
      /\bwhat(?:'s|\s+is)\s+wrong\s+with\s+me\b/i,
      /\bcan\s+you\s+diagnose\b/i,
      /\bwhat\s+(?:disease|condition|illness|infection)\s+(?:do\s+i\s+have|is\s+this)\b/i,
      /\bdoes\s+this\s+mean\s+i\s+have\b/i,
      /\bis\s+this\s+(?:cancer|a\s+tumou?r|an?\s+infection|a\s+disease)\b/i,
      /\bam\s+i\s+pregnant\b/i,
    ],
  },
  {
    rule_id: "medium_risk_medication_advice_001",
    risk_level: "medium",
    reason: "The patient requested medication advice requiring a clinician or pharmacist.",
    patterns: [
      /\bshould\s+i\s+(?:start|stop|change|increase|decrease|double|skip|reduce)\b/i,
      /\bcan\s+i\s+(?:start|stop|change|increase|decrease|double|skip|reduce)\s+(?:my\s+)?(?:dose|medicine|medication|pills?|tablets?)\b/i,
      /\b(?:change|adjust|increase|decrease|double|reduce)\s+(?:my\s+)?dose\b/i,
      /\bwhat\s+dose\s+(?:should|can)\s+i\s+take\b/i,
      /\bcan\s+i\s+take\s+.+\s+with\s+.+/i,
      /\b(?:prescribe|prescription)\b/i,
      /\bis\s+this\s+a\s+side\s+effect\b/i,
    ],
  },
  {
    rule_id: "medium_risk_test_interpretation_001",
    risk_level: "medium",
    reason: "The patient requested interpretation of a test or clinical result.",
    patterns: [
      /\bwhat\s+do\s+my\s+(?:test|lab|blood(?:\s+test)?|scan|x[-\s]?ray|mri|ct)\s+results?\s+mean\b/i,
      /\b(?:interpret|explain)\s+(?:my\s+)?(?:test|lab|blood|scan|x[-\s]?ray|mri|ct)\s+results?\b/i,
      /\bis\s+my\s+(?:test|result|blood\s+test|scan)\s+(?:normal|abnormal|bad|serious)\b/i,
      /\bmy\s+(?:test|result|scan)\s+(?:is|was|came\s+back)\s+positive\b/i,
    ],
  },
  {
    rule_id: "medium_risk_urgency_advice_001",
    risk_level: "medium",
    reason: "The patient asked for a clinician to judge the urgency of care.",
    patterns: [
      /\bshould\s+i\s+go\s+to\s+(?:the\s+)?(?:hospital|emergency|er|a&e|clinic)\b/i,
      /\bdo\s+i\s+need\s+to\s+(?:see|call|visit)\s+(?:a\s+|the\s+)?(?:doctor|nurse|clinician|hospital|clinic)\b/i,
      /\bis\s+this\s+(?:serious|dangerous|an\s+emergency|urgent)\b/i,
      /\bcan\s+(?:this|it)\s+wait\b/i,
      /\bhow\s+urgent\s+is\s+this\b/i,
    ],
  },
  {
    rule_id: "medium_risk_worsening_symptoms_001",
    risk_level: "medium",
    reason: "Worsening, persistent, or severe symptoms need clinical review.",
    patterns: [
      /\b(?:getting|becoming|feeling)\s+(?:much\s+)?worse\b/i,
      /\b(?:symptoms?|pain|condition)\s+(?:is|are|keeps?)\s+worsening\b/i,
      /\bnot\s+(?:getting\s+better|improving)\b/i,
      /\b(?:severe|unbearable|excruciating|worst)\s+pain\b/i,
      /\bpain\s+(?:is\s+)?(?:severe|unbearable|getting\s+worse)\b/i,
      /\b(?:fever|symptoms?)\s+(?:for|lasting)\s+(?:several|many|\d+)\s+days\b/i,
    ],
  },
  {
    rule_id: "medium_risk_human_review_request_001",
    risk_level: "medium",
    reason: "The patient explicitly requested advice from a healthcare professional.",
    patterns: [
      /\b(?:need|want|would\s+like)\s+(?:medical|clinical)\s+advice\b/i,
      /\b(?:need|want|would\s+like)\s+to\s+(?:talk|speak|chat)\s+(?:to|with)\s+(?:a\s+|the\s+)?(?:doctor|nurse|clinician|human)\b/i,
      /\b(?:send|show|forward)\s+(?:this|my\s+message|my\s+question)\s+to\s+(?:a\s+|the\s+)?(?:doctor|nurse|clinic|clinician)\b/i,
    ],
  },
  {
    rule_id: "medium_risk_ambiguous_concern_001",
    risk_level: "medium",
    reason: "The patient expressed a concerning but unclear health situation.",
    patterns: [
      /\bsomething\s+(?:is|feels)\s+(?:very\s+)?wrong\b/i,
      /\bfeel(?:ing)?\s+(?:really|very|extremely)\s+unwell\b/i,
      /\bworried\s+(?:that\s+)?(?:this|it)\s+(?:is|could\s+be|might\s+be)\s+serious\b/i,
      /\bnot\s+sure\s+how\s+to\s+(?:describe|explain)\s+(?:this|my\s+symptoms?)\b/i,
    ],
  },
];
