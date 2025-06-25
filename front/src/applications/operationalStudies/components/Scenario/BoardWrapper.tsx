import { KebabHorizontal } from '@osrd-project/ui-icons';

type BoardWrapperProps = {
  children: React.ReactNode;
  visible: boolean;
  name: string;
};

const BoardWrapper = ({ children, visible, name }: BoardWrapperProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="board-wrapper">
      <div className="board-header">
        <span className="board-header-name">{name}</span>
        <button type="button" className="board-header-button">
          <KebabHorizontal />
        </button>
      </div>
      <div className="board-body">{children}</div>
    </div>
  );
};

export default BoardWrapper;
