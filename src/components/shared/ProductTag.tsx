const productStyles: Record<string, string> = {
  PEEK: 'bg-[#EFF6FF] text-[#2563EB]',
  PAI: 'bg-[#F5F3FF] text-[#7C3AED]',
  PI: 'bg-[#EEF2FF] text-[#4F46E5]',
  PEI: 'bg-[#ECFDF5] text-[#059669]',
  PSU: 'bg-[#F0F9FF] text-[#0EA5E9]',
  PPSU: 'bg-[#FFF7ED] text-[#EA580C]',
  PPS: 'bg-[#FEFCE8] text-[#CA8A04]',
  PET: 'bg-[#F7FEE7] text-[#84CC16]',
  PA66: 'bg-[#FFF7ED] text-[#F97316]',
  POM: 'bg-gray-100 text-gray-500',
  PTFE: 'bg-[#FDF2F8] text-[#EC4899]',
  PCTFE: 'bg-[#FDF2F8] text-[#BE185D]',
  PVDF: 'bg-[#FEF2F2] text-[#EF4444]',
  PFA: 'bg-[#FFF1F2] text-[#FB7185]',
  HDPE: 'bg-[#F4F4F5] text-[#A1A1AA]',
};

export default function ProductTag({ family }: { family: string }) {
  const key = family.toUpperCase();
  const style = productStyles[key] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 ${style}`}>
      {key}
    </span>
  );
}
