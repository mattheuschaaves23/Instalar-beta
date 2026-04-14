import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  disable2FARequest,
  enable2FARequest,
  setup2FARequest,
} from '../../services/auth';
import PageIntro from '../Layout/PageIntro';
import { installationDayOptions, formatInstallationDays } from '../../utils/installerDays';

const initialForm = {
  name: '',
  phone: '',
  logo: '',
  installer_photo: '',
  installation_gallery: [],
  certificate_file: '',
  certificate_name: '',
  certification_verified: false,
  featured_installer: false,
  business_name: '',
  city: '',
  state: '',
  service_region: '',
  bio: '',
  installation_method: '',
  service_hours: '',
  installation_days: [],
  default_price_per_roll: 0,
  default_removal_price: 0,
  base_service_cost: 0,
  travel_fee: 0,
  monthly_goal: 5000,
  public_profile: true,
  years_experience: 0,
  wallpaper_store_recommended: true,
  document_type: 'cpf',
  document_id: '',
  emergency_contact: '',
  emergency_phone: '',
  safety_notes: '',
  accepts_service_contract: true,
  provides_warranty: true,
  warranty_days: 90,
  two_factor_enabled: false,
};

const initialSlotForm = {
  slot_date: '',
  start_time: '08:00',
  end_time: '10:00',
};

const imageHint = 'PNG, JPG ou WEBP (máx. 3MB). A imagem é salva no perfil.';
const certificateHint = 'PDF, PNG, JPG ou WEBP (máx. 5MB). O certificado é opcional.';

function buildMonthKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function buildDateKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSlotDate(value) {
  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isImageDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isPdfDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:application/pdf');
}

function getDocumentTypeLabel(type) {
  if (type === 'cnpj') {
    return 'CNPJ';
  }

  if (type === 'rg') {
    return 'RG';
  }

  return 'CPF';
}

function calculateSecurityScore(form) {
  const points = [
    Boolean(form.document_id),
    Boolean(form.installer_photo),
    Array.isArray(form.installation_gallery) && form.installation_gallery.length > 0,
    Boolean(form.certificate_file),
    Boolean(form.accepts_service_contract),
    Boolean(form.provides_warranty),
    Number(form.warranty_days || 0) > 0,
    Boolean(form.emergency_contact),
    Boolean(form.emergency_phone),
    Boolean(form.two_factor_enabled),
  ];

  const complete = points.filter(Boolean).length;
  return Math.round((complete / points.length) * 100);
}

function normalizeProfilePayload(payload) {
  const safePayload = payload || {};
  const gallery = Array.isArray(safePayload.installation_gallery)
    ? safePayload.installation_gallery
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  return {
    ...initialForm,
    ...safePayload,
    installation_gallery: gallery,
  };
}

export default function Profile() {
  const confirm = useConfirm();
  const { setUser } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [setup, setSetup] = useState(null);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [availabilityMonth, setAvailabilityMonth] = useState(buildMonthKey());
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotForm, setSlotForm] = useState(() => ({
    ...initialSlotForm,
    slot_date: buildDateKey(),
  }));

  const securityScore = useMemo(() => calculateSecurityScore(form), [form]);

  const loadAvailabilitySlots = useCallback(async (monthValue = availabilityMonth) => {
    setAvailabilityLoading(true);

    try {
      const response = await api.get('/users/availability', {
        params: { month: monthValue },
      });
      setAvailabilitySlots(response.data?.slots || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os horários vagos.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [availabilityMonth]);

  useEffect(() => {
    api
      .get('/users/profile')
      .then((response) => setForm(normalizeProfilePayload(response.data)))
      .catch(() => null);
  }, []);

  useEffect(() => {
    loadAvailabilitySlots(availabilityMonth);
  }, [availabilityMonth, loadAvailabilitySlots]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleInstallationDay = (day) => {
    setForm((current) => ({
      ...current,
      installation_days: current.installation_days.includes(day)
        ? current.installation_days.filter((item) => item !== day)
        : [...current.installation_days, day],
    }));
  };

  const handleImageUpload = async (fieldName, file) => {
    if (!file) {
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    if (!allowed.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 3MB.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((current) => ({ ...current, [fieldName]: dataUrl }));
      toast.success('Imagem carregada. Clique em salvar para aplicar.');
    } catch (_error) {
      toast.error('Não foi possível ler essa imagem.');
    }
  };

  const handleGalleryUpload = async (files) => {
    const fileList = Array.from(files || []);

    if (!fileList.length) {
      return;
    }

    const currentGallery = Array.isArray(form.installation_gallery) ? form.installation_gallery : [];
    const remainingSlots = Math.max(0, 10 - currentGallery.length);

    if (remainingSlots <= 0) {
      toast.error('Você já atingiu o limite de 10 fotos no portfólio.');
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const selectedFiles = fileList.slice(0, remainingSlots);
    const uploadedItems = [];

    for (const file of selectedFiles) {
      if (!allowed.includes(file.type)) {
        toast.error(`Formato inválido para "${file.name}". Use PNG, JPG ou WEBP.`);
        continue;
      }

      if (file.size > 3 * 1024 * 1024) {
        toast.error(`A foto "${file.name}" excede 3MB.`);
        continue;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        uploadedItems.push(dataUrl);
      } catch (_error) {
        toast.error(`Não foi possível carregar a foto "${file.name}".`);
      }
    }

    if (!uploadedItems.length) {
      return;
    }

    setForm((current) => ({
      ...current,
      installation_gallery: [...(current.installation_gallery || []), ...uploadedItems].slice(0, 10),
    }));
    toast.success(`${uploadedItems.length} foto(s) adicionada(s) ao portfólio.`);
  };

  const removeGalleryItem = (index) => {
    setForm((current) => ({
      ...current,
      installation_gallery: (current.installation_gallery || []).filter((_, position) => position !== index),
    }));
  };

  const handleCertificateUpload = async (file) => {
    if (!file) {
      return;
    }

    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];

    if (!allowed.includes(file.type)) {
      toast.error('Formato inválido. Envie PDF, PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O certificado deve ter no máximo 5MB.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((current) => ({
        ...current,
        certificate_file: dataUrl,
        certificate_name: file.name,
      }));
      toast.success('Certificado carregado. Clique em salvar para aplicar.');
    } catch (_error) {
      toast.error('Não foi possível carregar esse arquivo de certificado.');
    }
  };

  const clearCertificate = () => {
    setForm((current) => ({
      ...current,
      certificate_file: '',
      certificate_name: '',
      certification_verified: false,
    }));
  };

  const handleSlotInputChange = (event) => {
    const { name, value } = event.target;
    setSlotForm((current) => ({ ...current, [name]: value }));
  };

  const createAvailabilitySlot = async () => {
    if (!slotForm.slot_date || !slotForm.start_time || !slotForm.end_time) {
      toast.error('Preencha data, hora inicial e hora final.');
      return;
    }

    setSlotSaving(true);

    try {
      await api.post('/users/availability', slotForm);
      toast.success('Horário vago adicionado.');
      await loadAvailabilitySlots(availabilityMonth);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível adicionar o horário.');
    } finally {
      setSlotSaving(false);
    }
  };

  const removeAvailabilitySlotLegacy = async (slotId) => {
    if (!(await confirm('Deseja remover este horário vago?'))) {
      return;
    }

    try {
      await api.delete(`/users/availability/${slotId}`);
      toast.success('Horário removido.');
      await loadAvailabilitySlots(availabilityMonth);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível remover o horário.');
    }
  };

  const removeAvailabilitySlot = async (slotId) => {
    const confirmed = await confirm({
      title: 'Remover horário',
      message: 'Deseja remover este horário vago?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/users/availability/${slotId}`);
      toast.success('Horário removido.');
      await loadAvailabilitySlots(availabilityMonth);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível remover o horário.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await api.put('/users/profile', form);
      setForm(normalizeProfilePayload(response.data));
      setUser((current) => ({ ...current, ...response.data }));
      toast.success('Perfil do instalador atualizado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetup2FA = async () => {
    try {
      const response = await setup2FARequest();
      setSetup(response);
      toast.success('Escaneie o QR Code e confirme o código para ativar o 2FA.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível iniciar o 2FA.');
    }
  };

  const handleEnable2FA = async () => {
    try {
      await enable2FARequest({ secret: setup.secret, token });
      const profile = await api.get('/users/profile');
      setForm(normalizeProfilePayload(profile.data));
      setUser((current) => ({ ...current, ...profile.data }));
      setSetup(null);
      setToken('');
      toast.success('2FA ativado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível ativar o 2FA.');
    }
  };

  const handleDisable2FA = async () => {
    try {
      await disable2FARequest();
      const profile = await api.get('/users/profile');
      setForm(normalizeProfilePayload(profile.data));
      setUser((current) => ({ ...current, ...profile.data }));
      setSetup(null);
      setToken('');
      toast.success('2FA desativado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível desativar o 2FA.');
    }
  };

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description="Complete seu perfil para gerar confiança: foto profissional, logo usada no PDF, dados de segurança e horários vagos do mês."
        eyebrow="Perfil do instalador"
        stats={[
          {
            label: 'Empresa',
            value: form.business_name || form.name || 'Sem marca',
            detail: 'Nome que aparece para clientes e no ranking.',
          },
          {
            label: 'Dias de instalação',
            value: `${form.installation_days?.length || 0}`,
            detail: formatInstallationDays(form.installation_days),
          },
          {
            label: 'Segurança do perfil',
            value: `${securityScore}%`,
            detail: 'Quanto mais completo, maior a confiança do cliente.',
          },
        ]}
        title="Seu perfil precisa vender confiança antes mesmo da primeira conversa."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <form className="lux-panel fade-up p-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="field-label">Nome do responsável</span>
              <input className="field-input" name="name" onChange={handleChange} value={form.name || ''} />
            </label>

            <label className="block">
              <span className="field-label">Nome da empresa</span>
              <input
                className="field-input"
                name="business_name"
                onChange={handleChange}
                placeholder="Ex.: Studio Papel e Parede"
                value={form.business_name || ''}
              />
            </label>

            <label className="block">
              <span className="field-label">Telefone</span>
              <input className="field-input" name="phone" onChange={handleChange} value={form.phone || ''} />
            </label>

            <label className="block">
              <span className="field-label">Tipo de documento</span>
              <select className="field-select" name="document_type" onChange={handleChange} value={form.document_type || 'cpf'}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="rg">RG</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Número do documento (segurança)</span>
              <input
                className="field-input"
                name="document_id"
                onChange={handleChange}
                placeholder="Ex.: 123.456.789-00"
                value={form.document_id || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Logo para perfil e PDF</span>
              <input
                className="field-input"
                onChange={(event) => handleImageUpload('logo', event.target.files?.[0])}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">{imageHint}</p>
              {form.logo ? (
                <img
                  alt="Logo do instalador"
                  className="mt-3 h-20 w-20 rounded-[16px] border border-[var(--line)] object-cover"
                  src={form.logo}
                />
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Foto do instalador</span>
              <input
                className="field-input"
                onChange={(event) => handleImageUpload('installer_photo', event.target.files?.[0])}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Essa foto aparece no perfil público para reforçar a confiança.</p>
              {form.installer_photo ? (
                <img
                  alt="Foto do instalador"
                  className="mt-3 h-24 w-24 rounded-full border border-[var(--line)] object-cover"
                  src={form.installer_photo}
                />
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Portfólio de instalações (até 10 fotos)</span>
              <input
                className="field-input"
                onChange={(event) => handleGalleryUpload(event.target.files)}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Mostre ambientes já instalados para aumentar a confiança do cliente.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(form.installation_gallery || []).map((photo, index) => (
                  <article
                    className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-2"
                    key={`${index}-${photo.slice(0, 24)}`}
                  >
                    <img
                      alt={`Portfólio ${index + 1}`}
                      className="h-28 w-full rounded-[12px] object-cover"
                      src={photo}
                    />
                    <button
                      className="ghost-button mt-2 w-full !min-h-0 !px-3 !py-2 text-xs"
                      onClick={() => removeGalleryItem(index)}
                      type="button"
                    >
                      Remover foto
                    </button>
                  </article>
                ))}
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Certificado de instalador (opcional)</span>
              <input
                className="field-input"
                onChange={(event) => handleCertificateUpload(event.target.files?.[0])}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">{certificateHint}</p>

              {form.certificate_file ? (
                <div className="mt-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-pill" data-tone={form.certification_verified ? 'success' : 'pending'}>
                      {form.certification_verified ? 'Certificado verificado pelo ADM' : 'Aguardando validação do ADM'}
                    </span>
                    {form.featured_installer ? (
                      <span className="status-pill" data-tone="success">
                        Perfil destacado na vitrine
                      </span>
                    ) : null}
                  </div>

                  {isImageDataUrl(form.certificate_file) ? (
                    <img
                      alt="Certificado do instalador"
                      className="mt-3 max-h-56 w-full rounded-[14px] border border-[var(--line)] object-contain bg-white"
                      src={form.certificate_file}
                    />
                  ) : null}

                  {isPdfDataUrl(form.certificate_file) ? (
                    <a
                      className="gold-button mt-3 w-full justify-center"
                      href={form.certificate_file}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir certificado em PDF
                    </a>
                  ) : null}

                  {form.certificate_name ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">Arquivo: {form.certificate_name}</p>
                  ) : null}

                  <button className="ghost-button mt-3 w-full" onClick={clearCertificate} type="button">
                    Remover certificado
                  </button>
                </div>
              ) : null}
            </label>

            <label className="block">
              <span className="field-label">Cidade</span>
              <input className="field-input" name="city" onChange={handleChange} value={form.city || ''} />
            </label>

            <label className="block">
              <span className="field-label">Estado</span>
              <input className="field-input" name="state" onChange={handleChange} value={form.state || ''} />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Região que atende</span>
              <input
                className="field-input"
                name="service_region"
                onChange={handleChange}
                placeholder="Bairros, cidades próximas ou área principal"
                value={form.service_region || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Como instala</span>
              <textarea
                className="field-textarea"
                name="installation_method"
                onChange={handleChange}
                placeholder="Explique seu processo, acabamento, limpeza e preparação de parede."
                rows="4"
                value={form.installation_method || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Horários de atendimento</span>
              <input
                className="field-input"
                name="service_hours"
                onChange={handleChange}
                placeholder="Ex.: Segunda a sexta, das 08h às 18h"
                value={form.service_hours || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Apresentação pública</span>
              <textarea
                className="field-textarea"
                name="bio"
                onChange={handleChange}
                placeholder="Conte sua experiência, estilo de atendimento e diferenciais."
                rows="4"
                value={form.bio || ''}
              />
            </label>

            <div className="md:col-span-2">
              <span className="field-label">Dias que instala</span>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {installationDayOptions.map((day) => (
                  <label
                    className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text)]"
                    key={day.value}
                  >
                    <input
                      checked={form.installation_days.includes(day.value)}
                      className="field-checkbox"
                      onChange={() => toggleInstallationDay(day.value)}
                      type="checkbox"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-5">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="field-label">Mês dos horários vagos</span>
                  <input
                    className="field-input"
                    onChange={(event) => setAvailabilityMonth(event.target.value || buildMonthKey())}
                    type="month"
                    value={availabilityMonth}
                  />
                </label>
                <button className="ghost-button" onClick={() => loadAvailabilitySlots(availabilityMonth)} type="button">
                  Atualizar lista
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="block md:col-span-2">
                  <span className="field-label">Data</span>
                  <input
                    className="field-input"
                    min={buildDateKey()}
                    name="slot_date"
                    onChange={handleSlotInputChange}
                    type="date"
                    value={slotForm.slot_date}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Início</span>
                  <input
                    className="field-input"
                    name="start_time"
                    onChange={handleSlotInputChange}
                    type="time"
                    value={slotForm.start_time}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Fim</span>
                  <input
                    className="field-input"
                    name="end_time"
                    onChange={handleSlotInputChange}
                    type="time"
                    value={slotForm.end_time}
                  />
                </label>
              </div>

              <button className="gold-button mt-4" disabled={slotSaving} onClick={createAvailabilitySlot} type="button">
                {slotSaving ? 'Salvando horário...' : 'Adicionar horário vago'}
              </button>

              <div className="mt-4 grid gap-2">
                {availabilityLoading ? (
                  <div className="empty-state">Carregando horários vagos...</div>
                ) : null}

                {!availabilityLoading && availabilitySlots.length === 0 ? (
                  <div className="empty-state">
                    Nenhum horário vago cadastrado para este mês. Adicione acima para mostrar no perfil público.
                  </div>
                ) : null}

                {!availabilityLoading && availabilitySlots.length > 0
                  ? availabilitySlots.map((slot) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                        key={slot.id}
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {formatSlotDate(slot.slot_date)}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {slot.start_time} - {slot.end_time}
                          </p>
                        </div>
                        <button className="ghost-button" onClick={() => removeAvailabilitySlot(slot.id)} type="button">
                          Remover
                        </button>
                      </div>
                    ))
                  : null}
              </div>
            </div>

            <label className="block">
              <span className="field-label">Preço por rolo</span>
              <input
                className="field-input"
                name="default_price_per_roll"
                onChange={handleChange}
                type="number"
                value={form.default_price_per_roll || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Remoção padrão</span>
              <input
                className="field-input"
                name="default_removal_price"
                onChange={handleChange}
                type="number"
                value={form.default_removal_price || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Custo base da visita</span>
              <input
                className="field-input"
                name="base_service_cost"
                onChange={handleChange}
                type="number"
                value={form.base_service_cost || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Taxa de deslocamento</span>
              <input
                className="field-input"
                name="travel_fee"
                onChange={handleChange}
                type="number"
                value={form.travel_fee || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Meta mensal</span>
              <input
                className="field-input"
                name="monthly_goal"
                onChange={handleChange}
                type="number"
                value={form.monthly_goal || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Anos de experiência</span>
              <input
                className="field-input"
                name="years_experience"
                onChange={handleChange}
                type="number"
                value={form.years_experience || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Contato de emergência</span>
              <input
                className="field-input"
                name="emergency_contact"
                onChange={handleChange}
                placeholder="Nome do contato"
                value={form.emergency_contact || ''}
              />
            </label>

            <label className="block">
              <span className="field-label">Telefone de emergência</span>
              <input
                className="field-input"
                name="emergency_phone"
                onChange={handleChange}
                placeholder="(xx) xxxxx-xxxx"
                value={form.emergency_phone || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Observações de segurança para o cliente</span>
              <textarea
                className="field-textarea"
                name="safety_notes"
                onChange={handleChange}
                placeholder="Ex.: uso de EPIs, proteção do ambiente, contrato formal e checklist de entrega."
                rows="3"
                value={form.safety_notes || ''}
              />
            </label>

            <label className="block">
              <span className="field-label">Garantia (dias)</span>
              <input
                className="field-input"
                min="0"
                name="warranty_days"
                onChange={handleChange}
                type="number"
                value={form.warranty_days || 0}
              />
            </label>

            <div className="md:col-span-2 grid gap-3">
              <label className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text)]">
                <input
                  checked={Boolean(form.accepts_service_contract)}
                  className="field-checkbox"
                  name="accepts_service_contract"
                  onChange={handleChange}
                  type="checkbox"
                />
                Forneço contrato de serviço para o cliente
              </label>

              <label className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text)]">
                <input
                  checked={Boolean(form.provides_warranty)}
                  className="field-checkbox"
                  name="provides_warranty"
                  onChange={handleChange}
                  type="checkbox"
                />
                Ofereço garantia do serviço
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text)] md:col-span-2">
              <input
                checked={Boolean(form.public_profile)}
                className="field-checkbox"
                name="public_profile"
                onChange={handleChange}
                type="checkbox"
              />
              Mostrar meu perfil na busca pública de clientes
            </label>

            <label className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--text)] md:col-span-2">
              <input
                checked={Boolean(form.wallpaper_store_recommended)}
                className="field-checkbox"
                name="wallpaper_store_recommended"
                onChange={handleChange}
                type="checkbox"
              />
                      Mostrar a loja recomendada como opção de compra no meu perfil
            </label>
          </div>

          <button className="gold-button mt-6" disabled={saving} type="submit">
            {saving ? 'Salvando...' : 'Salvar perfil do instalador'}
          </button>
        </form>

        <aside className="grid gap-6">
          <section className="lux-panel fade-up p-6" style={{ animationDelay: '0.08s' }}>
            <p className="eyebrow">Confiança do cliente</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Selo de segurança do perfil</h2>

            <div className="mt-5 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-sm text-[var(--muted)]">Nível atual de segurança</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--gold-strong)]">{securityScore}%</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Documento: {getDocumentTypeLabel(form.document_type)} {form.document_id ? 'informado' : 'não informado'}.
              </p>
              <p className="text-sm leading-7 text-[var(--muted)]">
                Garantia: {form.provides_warranty ? `${form.warranty_days || 0} dias` : 'não oferece'}.
              </p>
              <p className="text-sm leading-7 text-[var(--muted)]">
                Contrato: {form.accepts_service_contract ? 'oferece contrato' : 'não informado'}.
              </p>
            </div>
          </section>

          <section className="lux-panel fade-up p-6" style={{ animationDelay: '0.1s' }}>
            <p className="eyebrow">Segurança</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Autenticação em dois fatores</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Proteja seu painel, os dados dos clientes e o faturamento com uma camada extra de segurança.
            </p>

            {!form.two_factor_enabled ? (
              <div className="mt-6 space-y-4">
                {!setup ? (
                  <button className="gold-button" onClick={handleSetup2FA} type="button">
                    Iniciar configuração
                  </button>
                ) : (
                  <div className="space-y-4">
                    <img
                      alt="QR Code de autenticação"
                      className="w-full rounded-[24px] border border-[var(--line)] bg-white p-4"
                      src={setup.qrCode}
                    />
                    <p className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm break-all text-[var(--muted)]">
                      Chave manual: <span className="text-[var(--gold-strong)]">{setup.secret}</span>
                    </p>
                    <label className="block">
                      <span className="field-label">Código do aplicativo</span>
                      <input
                        className="field-input"
                        onChange={(event) => setToken(event.target.value)}
                        placeholder="000000"
                        value={token}
                      />
                    </label>
                    <button className="gold-button w-full" onClick={handleEnable2FA} type="button">
                      Confirmar e ativar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-[22px] border border-[var(--line)] bg-[rgba(79,184,141,0.08)] p-5">
                <p className="text-sm text-[var(--muted)]">
                  O 2FA está ativo para esta conta. Isso dificulta acessos indevidos.
                </p>
                <button className="ghost-button mt-4" onClick={handleDisable2FA} type="button">
                  Desativar 2FA
                </button>
              </div>
            )}
          </section>

          <section className="lux-panel-soft fade-up rounded-[28px] p-6" style={{ animationDelay: '0.14s' }}>
            <p className="eyebrow">Vitrine pública</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Clientes enxergam mais segurança quando o perfil mostra foto do instalador, documento, contrato, garantia e horários vagos com clareza.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
