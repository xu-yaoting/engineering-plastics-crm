const productStyles: Record<string, string> = {
  PEEK: 'tag-peek',
  PAI: 'tag-pai',
  PI: 'tag-pai',
  PEI: 'tag-pei',
  PSU: 'tag-peek',
  PPSU: 'tag-ppsu',
  PPS: 'tag-pps',
  PET: 'tag-pei',
  PA66: 'tag-ppsu',
  POM: 'tag-pom',
  PTFE: 'tag-ptfe',
  PCTFE: 'tag-ptfe',
  PVDF: 'tag-ptfe',
  PFA: 'tag-ptfe',
  HDPE: 'tag-hdpe',
};

export default function ProductTag({ family }: { family: string }) {
  const key = family.toUpperCase();
  const style = productStyles[key] || 'bg-surface-hover text-ink-muted';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 ${style}`}>
      {key}
    </span>
  );
}
