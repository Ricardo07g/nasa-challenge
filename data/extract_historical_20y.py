"""
Script especializado para extrair a série histórica de 20 anos (2005-2024) da NASA POWER.
Atende ao requisito do desafio: avaliar em quantos anos haveria estresse hídrico ou térmico na safra.
Todos os dados são salvos na pasta 'output/'.
"""

from typing import Dict, List
from extract_nasa_power import fetch_nasa_power_data, save_to_csv, save_to_json


def summarize_by_year(daily_records: List[Dict]) -> List[Dict]:
    """
    Agrupa os dados diários por ano para gerar métricas agroclimáticas rápidas:
    - Chuva total do ano (mm)
    - Chuva no período da safrinha (fevereiro a maio)
    - Dias com calor extremo (Tmax >= 35°C)
    """
    anos: Dict[int, Dict] = {}

    for r in daily_records:
        data_str = r["date"]
        ano = int(data_str[:4])
        mes = int(data_str[5:7])

        if ano not in anos:
            anos[ano] = {
                "ano": ano,
                "chuva_total_mm": 0.0,
                "chuva_safrinha_fev_mai_mm": 0.0,
                "dias_calor_extremo_ge_35c": 0,
                "tmax_acumulada": 0.0,
                "dias_validos_tmax": 0,
            }

        chuva = r.get("PRECTOTCORR") or 0.0
        anos[ano]["chuva_total_mm"] += chuva

        # Período clássico da entressafra/safrinha (fevereiro a maio)
        if 2 <= mes <= 5:
            anos[ano]["chuva_safrinha_fev_mai_mm"] += chuva

        tmax = r.get("T2M_MAX")
        if tmax is not None:
            anos[ano]["tmax_acumulada"] += tmax
            anos[ano]["dias_validos_tmax"] += 1
            if tmax >= 35.0:
                anos[ano]["dias_calor_extremo_ge_35c"] += 1

    resumo = []
    for ano in sorted(anos.keys()):
        item = anos[ano]
        tmax_media = (
            item["tmax_acumulada"] / item["dias_validos_tmax"]
            if item["dias_validos_tmax"] > 0
            else 0.0
        )
        resumo.append({
            "ano": ano,
            "chuva_total_mm": round(item["chuva_total_mm"], 1),
            "chuva_safrinha_fev_mai_mm": round(item["chuva_safrinha_fev_mai_mm"], 1),
            "dias_calor_extremo_ge_35c": item["dias_calor_extremo_ge_35c"],
            "tmax_media_c": round(tmax_media, 1),
        })

    return resumo


def main():
    # Coordenadas da fazenda de exemplo (Uberlândia - Triângulo Mineiro)
    latitude = -18.9186
    longitude = -48.2772

    print(f"=== Extraindo 20 Anos de Dados NASA POWER (2005 - 2024) ===")
    print(f"Localização: Uberlândia - MG (Lat: {latitude}, Lon: {longitude})")

    # Extrai série diária histórica de 20 anos
    registros_20_anos = fetch_nasa_power_data(
        latitude=latitude,
        longitude=longitude,
        start_date="20050101",
        end_date="20241231",
    )

    # Gera resumo anual
    resumo_anual = summarize_by_year(registros_20_anos)

    # Salva dados diários completos na pasta output/
    save_to_json(registros_20_anos, "historico_uberlandia_20anos_diario.json")
    save_to_csv(registros_20_anos, "historico_uberlandia_20anos_diario.csv")

    # Salva resumo anual na pasta output/
    save_to_json(resumo_anual, "resumo_uberlandia_20anos_anual.json")
    save_to_csv(resumo_anual, "resumo_uberlandia_20anos_anual.csv")

    print("\n[RESUMO DOS 20 ANOS GERADO COM SUCESSO EM 'output/']")


if __name__ == "__main__":
    main()
