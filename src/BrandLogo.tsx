import logo from "@/imports/Nexostock.png";

export default function BrandLogo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <img
        src={logo}
        alt="Isotipo de Nexo Stock"
        className="size-11 shrink-0 object-contain"
      />
      {!compact && (
        <span className={`whitespace-nowrap text-lg font-bold tracking-[-.06em] ${dark ? "text-white" : "text-[#151515]"}`}>
          NEXO<span className={dark ? "text-[#80d3c9]" : "text-[#168178]"}>STOCK</span>
        </span>
      )}
    </div>
  );
}
