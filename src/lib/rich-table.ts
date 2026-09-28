/** Compact rich-message table. Cell text must already be HTML-safe. */

export type TableCell = {
  text: string;
  align?: "left" | "right" | "center";
  header?: boolean;
  bold?: boolean;
};

export function compactTable(rows: TableCell[][]): string {
  const body = rows
    .map((cells) => {
      const tds = cells
        .map((c) => {
          const tag = c.header ? "th" : "td";
          const align = c.align ? ` align="${c.align}"` : "";
          const inner = c.bold ? `<b>${c.text}</b>` : c.text;
          return `<${tag}${align}>${inner}</${tag}>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<table compact striped>${body}</table>`;
}
