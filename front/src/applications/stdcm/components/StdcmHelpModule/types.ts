export type Section = {
  id: string;
  title: string;
  content?: Content[];
  subSections?: Omit<Section, 'subSections'>[];
};

export type Content = ListContent | TextContent | FAQContent | GlossaryContent;

type ListContent = {
  type: 'list';
  items: { value: string }[];
};

type TextContent = {
  type: 'text';
  value: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type FAQContent = {
  type: 'faq';
  questions: FAQItem[];
};

type GlossaryContent = {
  type: 'definitions';
  definitions: GlossaryItem[];
};

type GlossaryItem = {
  term: string;
  definition: string;
};
