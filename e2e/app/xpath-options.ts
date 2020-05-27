export interface XPathOptions {
  type?: ElementType;
  name?: string;
  containsText?: string;
  normalizeSpace?: string;
  ancestorLevel?: number;
  iconShape?: string;
}

export enum ElementType {
  Button = 'button',
  Icon = 'icon',
  Checkbox = 'checkbox',
  RadioButton = 'radio',
  Textbox = 'text',
  Textarea = 'textarea',
  Link = 'link',
  Select = 'select',
  Dropdown = 'dropdown',
}
