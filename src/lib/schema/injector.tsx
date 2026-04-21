interface SchemaInjectorProps {
  schema: object | object[];
}

/**
 * Renders one or more JSON-LD schema blocks as <script type="application/ld+json">.
 * Accepts a single schema object or an array. Safe for Server Components.
 */
export function SchemaInjector({ schema }: SchemaInjectorProps) {
  const schemas = Array.isArray(schema) ? schema : [schema];
  return (
    <>
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}
