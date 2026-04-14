function pickCity(geocoding) {
  return (
    geocoding.city ||
    geocoding.town ||
    geocoding.village ||
    geocoding.municipality ||
    geocoding.locality ||
    geocoding.county ||
    ''
  );
}

async function reverseGeocode(lat, lon, acceptLanguage = 'pt-BR') {
  const searchParams = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lon),
    zoom: '18',
    layer: 'address',
    addressdetails: '1',
    'accept-language': acceptLanguage,
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${searchParams.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage,
      'User-Agent': `BemInstalado/1.0 (${process.env.NOMINATIM_EMAIL || 'contato@beminstalado.app'})`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar geolocalização: ${response.status}`);
  }

  const data = await response.json();
  const geocoding = data?.address || {};
  const city = pickCity(geocoding).trim();
  const state = (geocoding.state || '').trim();

  return {
    city,
    state,
    country: (geocoding.country || '').trim(),
    label: [city, state].filter(Boolean).join(' - ') || (data.display_name || '').trim(),
  };
}

module.exports = reverseGeocode;
