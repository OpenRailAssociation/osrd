import React, { useEffect, useRef, type DialogHTMLAttributes } from 'react';

import cx from 'classnames';

type ModalProps = DialogHTMLAttributes<HTMLDialogElement> & {
  fullscreen?: boolean;
  headerClassname?: string;
  bodyClassname?: string;
  footerClassname?: string;
  header: React.ReactNode;
  footer: React.ReactNode;
};

/**
 * Display a styled dialog box.
 * You are in charge of its lifecycle (open & close), this componant just display it.
 *
 * Children must be an array of 3 items, where :
 * - the first one is for the header
 * - the second one is for the content
 * - the last is for the footer
 *
 * NB: Inside header, only title tags have the good style (font weight and size)
 */
const Dialog = ({
  children,
  className,
  fullscreen = false,
  header,
  headerClassname,
  footer,
  footerClassname,
  bodyClassname,
  ...dialogProps
}: ModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  /**
   * When the dialog height change
   * => check if there is a scroll on the overlay and if so add a 'scroll' class on it
   */
  useEffect(() => {
    if (fullscreen) return;
    if (!overlayRef.current || !dialogRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (overlayRef.current) {
        if (overlayRef.current.scrollHeight > overlayRef.current.clientHeight) {
          overlayRef.current.classList.add('scroll');
        } else {
          overlayRef.current.classList.remove('scroll');
        }
      }
    });
    resizeObserver.observe(dialogRef.current);
    return () => resizeObserver.disconnect();
  }, [overlayRef, dialogRef, fullscreen]);

  return (
    <div
      ref={overlayRef}
      className="ui-dialog-overlay flex items-center justify-center"
      tabIndex={-1}
    >
      <dialog
        ref={dialogRef}
        {...dialogProps}
        className={cx('dialog-content', className, fullscreen && 'fullscreen')}
        open
      >
        <header className={cx(headerClassname)}>{header}</header>
        <section className={cx(bodyClassname)}>{children}</section>
        <footer className={cx(footerClassname)}>{footer}</footer>
      </dialog>
    </div>
  );
};

export default Dialog;
