type Props = {
  href: string;
  label: string;
};

/**
 * Branded WhatsApp call-to-action button.
 *
 * Rendered as a block-level element by its parent (LinkRenderer wraps
 * it in a `<span class="block">`) so it always appears on its OWN line,
 * never trailing inline at the end of a paragraph.
 *
 * Visual: WhatsApp green (#25D366), white inline SVG logo, white text,
 * subtle lift on hover. On mobile takes full width; on desktop hugs
 * content width. Designed to be instantly recognizable as a WhatsApp
 * deep-link button.
 */
export function WhatsAppButton({ href, label }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#25D366] font-medium text-white transition hover:bg-[#1ebe57] active:translate-y-px"
      style={{ padding: "4px 20px", fontSize: "12px" }}
    >
      <svg
        viewBox="0 0 32 32"
        className="h-3.5 w-3.5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.715.888.817 0 2.354-.515 2.74-1.318.143-.3.143-.557.143-.886-.13-.272-2.043-1.806-2.43-1.806zm-3.04 8.985h-.013a9.087 9.087 0 0 1-4.85-1.39l-.347-.218-3.6.97 1.014-3.42-.232-.357a9.073 9.073 0 0 1-1.388-4.844c.002-5.005 4.075-9.078 9.105-9.078a9.073 9.073 0 0 1 6.43 2.66 9.058 9.058 0 0 1 2.667 6.43c-.005 5.014-4.078 9.084-9.092 9.084v.005zm7.733-16.83A10.83 10.83 0 0 0 16.07 6.17c-5.962 0-10.825 4.863-10.825 10.828a10.78 10.78 0 0 0 1.45 5.413l-1.553 5.49 5.5-1.474a10.86 10.86 0 0 0 5.18 1.32H16.077c5.96 0 10.825-4.85 10.825-10.825a10.6 10.6 0 0 0-3.103-7.673z" />
      </svg>
      <span>{label}</span>
    </a>
  );
}
