import type { Content } from './types';

type SectionContentManagerProps = {
  content: Content;
};

const SectionContentManager = ({ content }: SectionContentManagerProps) => (
  <div className="section__content">
    {(() => {
      switch (content.type) {
        case 'list':
          return (
            <ul>
              {content.items.map((item, index) => (
                <li key={index}>{item.value}</li>
              ))}
            </ul>
          );

        case 'text':
          return <p dangerouslySetInnerHTML={{ __html: content.value }} />;
        case 'faq':
          return (
            <ol>
              {content.questions &&
                content.questions.map((question, index) => (
                  <li key={index}>
                    <h3>
                      {index + 1}. {question.question}
                    </h3>
                    <p>{question.answer}</p>
                  </li>
                ))}
            </ol>
          );
        case 'definitions':
          return (
            <table>
              <tbody>
                {content.definitions.map((item) => (
                  <tr key={item.term}>
                    <th scope="row">{item.term}</th>
                    <td>{item.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        default:
          return null;
      }
    })()}
  </div>
);

export default SectionContentManager;
