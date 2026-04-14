import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import { formatCurrency } from '../../utils/formatters';

const rollArea = 4.5;
const INSTALLMENT_OPTIONS = Array.from({ length: 11 }, (_, index) => index + 2);

function createEnvironment(defaultRemovalPrice = 0) {
  return {
    name: '',
    height: '',
    width: '',
    rolls_manual: '',
    removal_included: false,
    removal_price: defaultRemovalPrice > 0 ? String(defaultRemovalPrice) : '',
  };
}

export default function BudgetForm() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [pricingMode, setPricingMode] = useState('roll');
  const [pricePerRoll, setPricePerRoll] = useState(0);
  const [pricePerSquareMeter, setPricePerSquareMeter] = useState(10);
  const [defaultRemovalPrice, setDefaultRemovalPrice] = useState(0);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [environments, setEnvironments] = useState([createEnvironment()]);

  useEffect(() => {
    api.get('/clients').then((response) => setClients(response.data)).catch(() => null);
    api.get('/users/profile')
      .then((response) => {
        const profileDefaultRollPrice = Number(response.data.default_price_per_roll || 0);
        const profileDefaultRemovalPrice = Number(response.data.default_removal_price || 0);
        setPricePerRoll(profileDefaultRollPrice);
        setDefaultRemovalPrice(profileDefaultRemovalPrice);
        setEnvironments((current) => {
          if (
            current.length === 1 &&
            !current[0].name &&
            !current[0].height &&
            !current[0].width &&
            !current[0].rolls_manual
          ) {
            return [createEnvironment(profileDefaultRemovalPrice)];
          }
          return current;
        });
      })
      .catch(() => null);
  }, []);

  const updateEnvironment = (index, field, value) => {
    setEnvironments((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const toggleEnvironmentRemoval = (index, checked) => {
    setEnvironments((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item;
        }

        const currentPrice = String(item.removal_price || '').trim();
        const fallbackPrice = defaultRemovalPrice > 0 ? String(defaultRemovalPrice) : '';
        return {
          ...item,
          removal_included: checked,
          removal_price: checked ? (currentPrice || fallbackPrice) : item.removal_price,
        };
      })
    );
  };

  const addEnvironment = () => {
    setEnvironments((current) => [...current, createEnvironment(defaultRemovalPrice)]);
  };

  const removeEnvironment = (index) => {
    setEnvironments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const totals = useMemo(
    () =>
      environments.reduce(
        (accumulator, environment) => {
          const height = Number(environment.height || 0);
          const width = Number(environment.width || 0);
          const area = height * width;
          const rollsAuto = Math.ceil(area / rollArea || 0);
          const rollsManual = environment.rolls_manual ? Number(environment.rolls_manual) : null;
          const rollsForMode = pricingMode === 'roll' ? (rollsManual || rollsAuto) : rollsAuto;
          const baseSubtotal =
            pricingMode === 'square_meter'
              ? area * Number(pricePerSquareMeter || 0)
              : rollsForMode * Number(pricePerRoll || 0);

          const removalSelected = Boolean(environment.removal_included);
          const removalValue = removalSelected ? Number(environment.removal_price || 0) : 0;
          const safeRemovalValue = Number.isFinite(removalValue) ? removalValue : 0;
          const environmentTotal = baseSubtotal + safeRemovalValue;

          return {
            area: accumulator.area + area,
            rolls: accumulator.rolls + rollsForMode,
            subtotal: accumulator.subtotal + baseSubtotal,
            removal: accumulator.removal + safeRemovalValue,
            total: accumulator.total + environmentTotal,
          };
        },
        { area: 0, rolls: 0, subtotal: 0, removal: 0, total: 0 }
      ),
    [environments, pricePerRoll, pricePerSquareMeter, pricingMode]
  );

  const grandTotal = totals.total;
  const normalizedInstallments = installmentEnabled ? Number(installmentsCount || 2) : 1;
  const installmentValue = normalizedInstallments > 0 ? grandTotal / normalizedInstallments : grandTotal;
  const basePricingLabel = pricingMode === 'square_meter' ? 'Subtotal por m²' : 'Subtotal dos papéis';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedClientId = Number(clientId);
    const normalizedPricePerRoll = Number(pricePerRoll);
    const normalizedPricePerSquareMeter = Number(pricePerSquareMeter);
    const normalizedInstallmentsCount = Number(installmentsCount);

    if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
      toast.error('Selecione um cliente válido.');
      return;
    }

    if (pricingMode === 'roll' && (!Number.isFinite(normalizedPricePerRoll) || normalizedPricePerRoll <= 0)) {
      toast.error('Informe um preço por rolo maior que zero.');
      return;
    }

    if (pricingMode === 'square_meter' && (!Number.isFinite(normalizedPricePerSquareMeter) || normalizedPricePerSquareMeter <= 0)) {
      toast.error('Informe um preço por metro quadrado maior que zero.');
      return;
    }

    if (
      installmentEnabled &&
      (!Number.isInteger(normalizedInstallmentsCount) ||
        normalizedInstallmentsCount < 2 ||
        normalizedInstallmentsCount > 12)
    ) {
      toast.error('Escolha um parcelamento entre 2x e 12x.');
      return;
    }

    const invalidEnvironment = environments.find((environment) => {
      const height = Number(environment.height);
      const width = Number(environment.width);
      const hasManualRolls = String(environment.rolls_manual || '').trim() !== '';
      const manualRolls = hasManualRolls ? Number(environment.rolls_manual) : null;
      const removalSelected = Boolean(environment.removal_included);
      const removalValue = removalSelected ? Number(environment.removal_price) : 0;

      return (
        !String(environment.name || '').trim() ||
        !Number.isFinite(height) ||
        height <= 0 ||
        !Number.isFinite(width) ||
        width <= 0 ||
        (pricingMode === 'roll' && hasManualRolls && (!Number.isInteger(manualRolls) || manualRolls <= 0)) ||
        (removalSelected && (!Number.isFinite(removalValue) || removalValue < 0))
      );
    });

    if (invalidEnvironment) {
      toast.error('Revise os ambientes: nome, medidas, rolos e remoção precisam estar válidos.');
      return;
    }

    try {
      await api.post('/budgets', {
        client_id: normalizedClientId,
        pricing_mode: pricingMode,
        price_per_roll: normalizedPricePerRoll,
        price_per_square_meter: normalizedPricePerSquareMeter,
        installment_enabled: installmentEnabled,
        installments_count: installmentEnabled ? normalizedInstallmentsCount : 1,
        removal_included: false,
        removal_price: 0,
        environments: environments.map((environment) => ({
          name: environment.name,
          height: Number(environment.height),
          width: Number(environment.width),
          rolls_manual:
            pricingMode === 'roll' && environment.rolls_manual
              ? Number(environment.rolls_manual)
              : null,
          removal_included: Boolean(environment.removal_included),
          removal_price: environment.removal_included ? Number(environment.removal_price || 0) : 0,
        })),
      });

      toast.success('Orçamento criado.');
      navigate('/budgets');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível criar o orçamento.');
    }
  };

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description="Agora você tem dois cálculos: por rolo ou por metro quadrado, além de remoção por ambiente e parcelamento."
        eyebrow="Nova proposta"
        stats={[
          { label: 'Área total', value: `${totals.area.toFixed(2)} m²`, detail: 'Soma de todos os ambientes.' },
          { label: 'Rolos previstos', value: `${totals.rolls}`, detail: 'Planejamento de material.' },
          { label: 'Total estimado', value: formatCurrency(grandTotal), detail: 'Já considera remoções por ambiente.' },
        ]}
        title="Monte orçamento por rolo ou por metro quadrado em poucos cliques."
      />

      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit}>
        <div className="lux-panel fade-up p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="field-label">Cliente</span>
              <select className="field-select" onChange={(event) => setClientId(event.target.value)} required value={clientId}>
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
              <p className="field-label">Modo da calculadora</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[14px] border border-[var(--line)] px-4 py-3">
                  <input
                    checked={pricingMode === 'roll'}
                    className="field-checkbox"
                    name="pricing_mode"
                    onChange={() => setPricingMode('roll')}
                    type="radio"
                  />
                  <span className="text-sm text-[var(--text)]">Cobrar por rolo</span>
                </label>
                <label className="flex items-center gap-3 rounded-[14px] border border-[var(--line)] px-4 py-3">
                  <input
                    checked={pricingMode === 'square_meter'}
                    className="field-checkbox"
                    name="pricing_mode"
                    onChange={() => setPricingMode('square_meter')}
                    type="radio"
                  />
                  <span className="text-sm text-[var(--text)]">Cobrar por m²</span>
                </label>
              </div>
            </div>

            {pricingMode === 'roll' ? (
              <label className="block">
                <span className="field-label">Preço por rolo</span>
                <input
                  className="field-input"
                  onChange={(event) => setPricePerRoll(event.target.value)}
                  placeholder="0,00"
                  min="0.01"
                  required
                  step="0.01"
                  type="number"
                  value={pricePerRoll}
                />
              </label>
            ) : (
              <label className="block">
                <span className="field-label">Preço por metro quadrado (R$/m²)</span>
                <input
                  className="field-input"
                  onChange={(event) => setPricePerSquareMeter(event.target.value)}
                  placeholder="Ex.: 10,00"
                  min="0.01"
                  required
                  step="0.01"
                  type="number"
                  value={pricePerSquareMeter}
                />
              </label>
            )}

            <label className="block">
              <span className="field-label">Valor padrão de remoção (por ambiente)</span>
              <input
                className="field-input"
                onChange={(event) => setDefaultRemovalPrice(Number(event.target.value || 0))}
                placeholder="0,00"
                min="0"
                step="0.01"
                type="number"
                value={defaultRemovalPrice}
              />
            </label>
          </div>

          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
            <label className="flex items-center gap-3">
              <input
                checked={installmentEnabled}
                className="field-checkbox"
                onChange={(event) => setInstallmentEnabled(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm text-[var(--text)]">Permitir pagamento parcelado</span>
            </label>

            {installmentEnabled ? (
              <label className="mt-4 block">
                <span className="field-label">Número de parcelas</span>
                <select
                  className="field-select"
                  onChange={(event) => setInstallmentsCount(Number(event.target.value))}
                  value={installmentsCount}
                >
                  {INSTALLMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}x de {formatCurrency(grandTotal / option)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4">
            {environments.map((environment, index) => {
              const height = Number(environment.height || 0);
              const width = Number(environment.width || 0);
              const area = height * width;
              const rollsAuto = Math.ceil(area / rollArea || 0);
              const rollsManual = environment.rolls_manual ? Number(environment.rolls_manual) : null;
              const rollsForMode = pricingMode === 'roll' ? (rollsManual || rollsAuto) : rollsAuto;
              const baseSubtotal =
                pricingMode === 'square_meter'
                  ? area * Number(pricePerSquareMeter || 0)
                  : rollsForMode * Number(pricePerRoll || 0);
              const removalValue = environment.removal_included ? Number(environment.removal_price || 0) : 0;
              const environmentTotal = baseSubtotal + (Number.isFinite(removalValue) ? removalValue : 0);

              return (
                <div className="lux-panel-soft rounded-[24px] p-5" key={`env-${index}`}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-[var(--text)]">Ambiente {index + 1}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {pricingMode === 'square_meter'
                          ? 'Defina medidas e valor por m² neste ambiente.'
                          : 'Defina medidas, rolos e remoção deste ambiente.'}
                      </p>
                    </div>
                    {environments.length > 1 ? (
                      <button className="ghost-button !min-h-0 !px-4 !py-2 text-xs" onClick={() => removeEnvironment(index)} type="button">
                        Remover
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      className="field-input md:col-span-2"
                      onChange={(event) => updateEnvironment(index, 'name', event.target.value)}
                      placeholder="Nome do ambiente"
                      required
                      value={environment.name}
                    />
                    <input
                      className="field-input"
                      onChange={(event) => updateEnvironment(index, 'height', event.target.value)}
                      placeholder="Altura"
                      min="0.01"
                      required
                      step="0.01"
                      type="number"
                      value={environment.height}
                    />
                    <input
                      className="field-input"
                      onChange={(event) => updateEnvironment(index, 'width', event.target.value)}
                      placeholder="Largura"
                      min="0.01"
                      required
                      step="0.01"
                      type="number"
                      value={environment.width}
                    />
                    {pricingMode === 'roll' ? (
                      <input
                        className="field-input md:col-span-2"
                        onChange={(event) => updateEnvironment(index, 'rolls_manual', event.target.value)}
                        placeholder="Rolos manuais (opcional)"
                        min="1"
                        step="1"
                        type="number"
                        value={environment.rolls_manual}
                      />
                    ) : null}
                  </div>

                  <label className="mt-4 flex items-center gap-3 rounded-[14px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                    <input
                      checked={Boolean(environment.removal_included)}
                      className="field-checkbox"
                      onChange={(event) => toggleEnvironmentRemoval(index, event.target.checked)}
                      type="checkbox"
                    />
                    <span className="text-sm text-[var(--text)]">Incluir remoção neste ambiente</span>
                  </label>

                  {environment.removal_included ? (
                    <label className="mt-3 block">
                      <span className="field-label">Valor da remoção deste ambiente</span>
                      <input
                        className="field-input"
                        min="0"
                        onChange={(event) => updateEnvironment(index, 'removal_price', event.target.value)}
                        step="0.01"
                        type="number"
                        value={environment.removal_price}
                      />
                    </label>
                  ) : null}

                  <div className="mt-4 rounded-[14px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div className="flex items-center justify-between">
                      <span>{pricingMode === 'square_meter' ? 'Subtotal por m²' : 'Subtotal dos papéis'}</span>
                      <strong className="text-[var(--text)]">{formatCurrency(baseSubtotal)}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Remoção do ambiente</span>
                      <strong className="text-[var(--text)]">{formatCurrency(environment.removal_included ? removalValue : 0)}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2">
                      <span>Total do ambiente</span>
                      <strong className="text-[var(--gold-strong)]">{formatCurrency(environmentTotal)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="ghost-button" onClick={addEnvironment} type="button">
              Adicionar ambiente
            </button>
            <button className="gold-button" type="submit">
              Salvar orçamento
            </button>
          </div>
        </div>

        <aside className="grid gap-6">
          <div className="metric-card fade-up" style={{ animationDelay: '0.08s' }}>
            <p className="eyebrow">Resumo financeiro</p>
            <div className="mt-5 grid gap-4 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>{basePricingLabel}</span>
                <strong className="text-[var(--text)]">{formatCurrency(totals.subtotal)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Remoção (ambientes)</span>
                <strong className="text-[var(--text)]">{formatCurrency(totals.removal)}</strong>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
                <span>Total estimado</span>
                <strong className="text-xl text-[var(--gold-strong)]">{formatCurrency(grandTotal)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Pagamento</span>
                <strong className="text-[var(--text)]">{installmentEnabled ? 'Parcelado' : 'À vista'}</strong>
              </div>
              {installmentEnabled ? (
                <div className="flex items-center justify-between">
                  <span>Parcelas</span>
                  <strong className="text-[var(--text)]">
                    {normalizedInstallments}x de {formatCurrency(installmentValue)}
                  </strong>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lux-panel-soft fade-up rounded-[28px] p-6" style={{ animationDelay: '0.15s' }}>
            <p className="eyebrow">Dica de fechamento</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Se você cobrar por metro quadrado, use um valor simples para o cliente entender rápido.
              Exemplo: R$ 10,00 por m².
            </p>
          </div>
        </aside>
      </form>
    </section>
  );
}
