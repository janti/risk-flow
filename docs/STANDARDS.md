# Standard guidance

RiskFlow does not implement a compliance-mapping module or a control library (out of MVP). Public risk-management principles are wired into the existing register, assessment, and treatment as category-based guidance.

Guidance is not certification and does not replace official standard text or law.

## Sources

| Source | Use in the app |
|---|---|
| [ISO 31000:2018](https://www.iso.org/standard/65694.html) | Process (context → assessment → treatment → monitoring) and strategies avoid / reduce / share / accept. [SFS overview](https://sfs.fi/standardeista/tutustu-standardeihin/suositut-standardit/iso-31000-riskienhallinta/). |
| [ISO 45001:2018](https://www.iso.org/standard/63787.html) 8.1.2 | Occupational-safety control hierarchy in the Operations/OHS category. |
| [Finnish OSH Administration, hazard assessment](https://tyosuojelu.fi/tyosuojelu-tyopaikalla/vaarojen-arviointi) | Likelihood × consequence scale and the employer's duty to assess hazards. |
| [Centre for Occupational Safety, hazard assessment](https://ttk.fi/tyoturvallisuus/vastuut-tyopaikalla/vaarojen-arviointi/) | OHS identification prompts in the Operations/OHS category. |
| [Occupational Safety and Health Act 738/2002 §10](https://www.ttl.fi/teemat/tyoturvallisuus/tyoturvallisuuslain-soveltamisopas/tyonantajan-yleiset-velvollisuudet/10-ss-tyon-vaarojen-selvittaminen-ja-arviointi) | Identifying hazards, eliminating them, and assessing residual risk. |
| [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) 6.1 and Annex A themes | Information-security risk identification (CIA) and four control themes, not a library of 93 controls. |
| [ISO/IEC 27005:2022](https://www.iso.org/standard/80585.html) | Information-security risk process on top of ISO 31000. |
| [NIST CSF 2.0](https://www.nist.gov/cyberframework) | Govern, Identify, Protect, Detect, Respond, Recover as treatment hints. |

## How guidance is used

- Create/edit risk: category is chosen before description. Identification questions and the description template change with category (`OPS` → occupational safety, `CYBER` → information security). On a new risk, an empty description is filled from the template; the *Use guidance template* button writes the template into the field.
- Assessment: likelihood and impact options use the OSH/ISO scale; the rationale placeholder requires a source and residual risk.
- Treatment: ISO 31000 strategy copy plus category-specific control hints (for example ISO 45001 hierarchy). The acceptance rationale placeholder is the ISO 31000 accept guidance.

Catalogue: `packages/risk-engine/src/guidance.ts`.
