interface PrintSheetProps {
  printSvgs: string[];
}

interface SuccessToastProps {
  message: string;
}

export function PrintSheet({ printSvgs }: PrintSheetProps) {
  return (
    <section className="print-sheet" aria-hidden="true">
      {printSvgs.map((svg, index) => (
        <div key={index} className="print-label" dangerouslySetInnerHTML={{ __html: svg }} />
      ))}
    </section>
  );
}

export function SuccessToast({ message }: SuccessToastProps) {
  return (
    <div className="success-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
