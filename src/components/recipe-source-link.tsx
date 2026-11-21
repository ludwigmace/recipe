import { getRecipeSourceDomain } from "@/lib/recipe-source";

export function RecipeSourceLink({
  sourceUrl,
  className,
}: {
  sourceUrl: string;
  className?: string;
}) {
  const domain = getRecipeSourceDomain(sourceUrl);

  return (
    <a
      className={className}
      href={sourceUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Visit ${domain} (opens in a new tab)`}
      title={sourceUrl}
    >
      <span>{domain}</span>
      <svg
        aria-hidden="true"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 3h7v7" />
        <path d="M10 14 21 3" />
        <path d="M21 14v7H3V3h7" />
      </svg>
    </a>
  );
}
