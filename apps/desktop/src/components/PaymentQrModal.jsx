import { useEffect, useState } from 'react';

function isFinderCell(row, column, originRow, originColumn) {
  const y = row - originRow;
  const x = column - originColumn;
  if (x < 0 || x > 6 || y < 0 || y > 6) return false;
  return x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
}

function QrExample() {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const row = Math.floor(index / 21);
    const column = index % 21;
    const finder =
      isFinderCell(row, column, 0, 0) ||
      isFinderCell(row, column, 0, 14) ||
      isFinderCell(row, column, 14, 0);
    return finder || ((row * 7 + column * 11 + row * column) % 5 < 2 && row > 7 && column > 7);
  });

  return (
    <div
      aria-label="Código QR de ejemplo"
      className="grid aspect-square w-44 grid-cols-[repeat(21,minmax(0,1fr))] gap-px rounded-lg bg-white p-2"
      role="img"
    >
      {cells.map((isDark, index) => (
        <span className={isDark ? 'bg-slate-950' : 'bg-white'} key={index} />
      ))}
    </div>
  );
}

function PaymentQrModal({ reservation, onClose, onPaid }) {
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!reservation) return null;

  function confirmPayment() {
    if (paid) return;
    setPaid(true);
    onPaid?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="qr-title"
        aria-modal="true"
        className="relative my-auto w-full max-w-md space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        role="dialog"
      >
        <button
          aria-label="Cerrar"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">✕</span>
        </button>

        <div className="space-y-1 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-xl text-emerald-300">
            <span aria-hidden="true">{paid ? '✓' : '▦'}</span>
          </span>
          <h2 className="text-xl font-extrabold" id="qr-title">
            {paid ? '¡Pago verificado!' : 'Escanea el código QR para pagar'}
          </h2>
          <p className="text-xs text-slate-400">
            {paid
              ? 'La reserva quedó confirmada en esta demostración.'
              : 'Pago seguro mediante Simple QR / Banca Móvil'}
          </p>
        </div>

        <div className="mx-auto max-w-[210px] rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
          <QrExample />
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
          <div className="flex justify-between gap-3 text-slate-400">
            <span>Monto a transferir:</span>
            <span className="font-bold text-emerald-400">{reservation.totalLabel}</span>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>Mesa reservada:</span>
            <span className="font-medium text-white">{reservation.tableName}</span>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>Cliente:</span>
            <span className="max-w-[60%] truncate text-right text-slate-200">
              {reservation.customerName}
            </span>
          </div>
          <div className="flex justify-between gap-3 text-slate-400">
            <span>{reservation.date}</span>
            <span>{reservation.startTime}–{reservation.endTime}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-800 pt-2 text-slate-400">
            <span>Estado del pago:</span>
            {paid ? (
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <span aria-hidden="true">✓</span> Pago verificado
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"
                />
                Esperando transferencia…
              </span>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          Código QR de demostración; no procesa pagos reales.
        </p>

        {paid ? (
          <button
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
            onClick={onClose}
            type="button"
          >
            Listo
          </button>
        ) : (
          <div className="space-y-2">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
              onClick={confirmPayment}
              type="button"
            >
              <span aria-hidden="true">✓</span> Simular confirmación de pago
            </button>
            <button
              className="w-full rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default PaymentQrModal;
