"""
Script simples para extração de dados da NASA POWER API (v2 - Agroclimatology).
Pode ser executado diretamente ou importado como função em qualquer backend.
Todos os arquivos gerados são salvos no diretório 'output/'.
"""

import json
import os
from typing import Any, Dict, List, Optional
import requests

# Diretório padrão para salvar dados extraídos
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Variáveis agroclimáticas recomendadas para o desafio Space Apps
DEFAULT_PARAMETERS = [
    "PRECTOTCORR",       # Precipitação / Chuva (mm/dia)
    "T2M_MAX",           # Temperatura máxima a 2m (°C)
    "T2M_MIN",           # Temperatura mínima a 2m (°C)
    "T2M",               # Temperatura média a 2m (°C)
    "RH2M",              # Umidade relativa do ar a 2m (%)
    "WS2M",              # Velocidade do vento a 2m (m/s)
    "ALLSKY_SFC_SW_DWN", # Radiação solar de onda curta (MJ/m²/dia)
    "GWETROOT",          # Umidade na zona radicular do solo (fração 0-1)
]

BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"


def fetch_nasa_power_data(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    parameters: Optional[List[str]] = None,
    timeout: int = 60
) -> List[Dict[str, Any]]:
    """
    Busca dados diários da NASA POWER para uma coordenada e período (YYYYMMDD).
    Trata automaticamente os valores faltantes (-999.0) convertendo para None.

    Retorna uma lista de registros por dia:
    [
        {"date": "2024-01-01", "PRECTOTCORR": 12.4, "T2M_MAX": 31.2, ...},
        {"date": "2024-01-02", "PRECTOTCORR": 0.0,  "T2M_MAX": 32.5, ...}
    ]
    """
    if parameters is None:
        parameters = DEFAULT_PARAMETERS

    params = {
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "start": start_date,
        "end": end_date,
        "parameters": ",".join(parameters),
        "community": "AG",
        "format": "JSON",
        "header": "true",
    }

    print(f"[NASA POWER] Solicitando dados para Lat {latitude}, Lon {longitude} ({start_date} a {end_date})...")
    response = requests.get(BASE_URL, params=params, timeout=timeout)
    response.raise_for_status()

    raw_data = response.json()
    param_dict = raw_data.get("properties", {}).get("parameter", {})

    if not param_dict:
        return []

    # Extrai todas as datas retornadas
    primeira_variavel = next(iter(param_dict.values()))
    datas = sorted(primeira_variavel.keys())

    registros = []
    for d in datas:
        # Formata data para YYYY-MM-DD
        data_formatada = f"{d[:4]}-{d[4:6]}-{d[6:]}" if len(d) == 8 else d
        dia = {"date": data_formatada}

        for var_name, valores in param_dict.items():
            val = valores.get(d)
            # Trata valor de dado ausente da NASA (-999)
            if val is None or val == -999.0 or val == -999:
                dia[var_name] = None
            else:
                dia[var_name] = float(val)

        registros.append(dia)

    print(f"[NASA POWER] Sucesso! {len(registros)} registros diários processados.")
    return registros


def save_to_json(data: Any, filename: str, output_dir: Optional[str] = None) -> str:
    """Salva dados em formato JSON formatado dentro do diretório de saída."""
    target_dir = output_dir or OUTPUT_DIR
    os.makedirs(target_dir, exist_ok=True)
    filepath = os.path.join(target_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[ARQUIVO] Salvo em JSON: {filepath}")
    return filepath


def save_to_csv(records: List[Dict[str, Any]], filename: str, output_dir: Optional[str] = None) -> str:
    """Salva a lista de registros diários em formato CSV dentro do diretório de saída."""
    target_dir = output_dir or OUTPUT_DIR
    os.makedirs(target_dir, exist_ok=True)
    filepath = os.path.join(target_dir, filename)

    try:
        import pandas as pd
        df = pd.DataFrame(records)
        df.to_csv(filepath, index=False)
        print(f"[ARQUIVO] Salvo em CSV: {filepath}")
    except ImportError:
        # Fallback simples caso pandas não esteja instalado
        if records:
            headers = list(records[0].keys())
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(",".join(headers) + "\n")
                for r in records:
                    row = [str(r.get(h, "")) if r.get(h) is not None else "" for h in headers]
                    f.write(",".join(row) + "\n")
            print(f"[ARQUIVO] Salvo em CSV (modo texto): {filepath}")
    return filepath


if __name__ == "__main__":
    # Exemplo de extração pontual: safra recente em Uberlândia - MG
    lat_uberlandia = -18.9186
    lon_uberlandia = -48.2772

    dados = fetch_nasa_power_data(
        latitude=lat_uberlandia,
        longitude=lon_uberlandia,
        start_date="20240101",
        end_date="20240331",
    )

    save_to_json(dados, "nasa_power_sample.json")
    save_to_csv(dados, "nasa_power_sample.csv")
