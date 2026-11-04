import { useState } from 'react';

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
        <span key={index} className={isDark ? 'bg-slate-950' : 'bg-white'} />
      ))}
    </div>
  );
}

function PaymentQrModal({ reservation, onClose }) {
  const [paid, setPaid] = useState(false);

  if (!reservation) return null;

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
        className="relative my-auto w-full max-w-md space-y-5 rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        role="dialog"
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          ✕
        </button>

        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-xl text-emerald-300">
            {paid ? '✓' : '▦'}
          </span>
          <h2 id="qr-title" className="mt-3 text-xl font-extrabold">
            {paid ? '¡Pago confirmado!' : 'Paga con código QR'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {paid
              ? 'La reserva quedó confirmada en esta demostración.'
              : 'Escanea el código desde tu aplicación bancaria.'}
          </p>
        </div>

        {!paid && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <QrExample />
            <p className="text-center text-[11px] text-slate-500">
              Código QR de demostración; no procesa pagos reales.
            </p>
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
          <div className="flex justify-between gap-3 text-slate-400">
            <span>Cliente</span>
            <span className="text-right text-slate-200">{reservation.customerName}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>{reservation.tableName} · {reservation.date}</span>
            <span>{reservation.startTime}–{reservation.endTime}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-3 font-bold">
            <span>Total de reserva</span>
            <span className="text-emerald-300">{reservation.totalLabel}</span>
          </div>
        </div>

        {paid ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
          >
            Listo
          </button>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPaid(true)}
              className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
            >
              Simular confirmación de pago
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
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
