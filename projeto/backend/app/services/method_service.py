"""Regras da tela "Como a conta é feita" (S9 da remodelagem, tarefa 0049).

Só escolhe, nas regras do motor, os números que a tela explica (e passa frações para %): a conta
continua nos outros services. Assim a tela nunca repete número fixo.
"""

from typing import Final

from app.models.metodo import (
    AguaRegra,
    AlertasRegra,
    AvisosRegra,
    DeuCertoRegra,
    MetodoRegras,
    PesosRegra,
    PlanoBRegra,
    RendaRegra,
    RotacaoRegra,
    SinalRegra,
)
from app.models.regras import Regras
from app.repositories.rules_repository import load_default_rules

PERCENT: Final[int] = 100


def _pct(fraction: float) -> int:
    return round(fraction * PERCENT)


class MethodService:
    def __init__(self, rules: Regras | None = None) -> None:
        self._rules = rules if rules is not None else load_default_rules()

    def rules(self) -> MetodoRegras:
        r = self._rules
        return MetodoRegras(
            deu_certo=DeuCertoRegra(
                isna_grao_pct=_pct(r.clima.isna_grao),
                isna_cobertura_pct=_pct(r.clima.isna_cobertura),
                janela_grao_meia_dias=r.clima.janela_grao_meia_dias,
                janela_cobertura_dias=r.clima.janela_cobertura_dias,
                calor_temp_c=r.clima.calor_temp_c,
                calor_min_dias=r.clima.calor_min_dias,
                isna_por_cultura_pct={
                    crop: _pct(isna) for crop, isna in sorted(r.clima.isna_por_cultura.items())
                },
            ),
            pesos=PesosRegra(
                seguranca_pct=_pct(r.nota_final.peso_seguranca),
                futuro_pct=_pct(r.nota_final.peso_futuro),
                solo_pct=_pct(r.nota_final.peso_solo),
                renda_pct=_pct(r.nota_final.peso_renda),
            ),
            renda=RendaRegra(
                tipos_com_grao=tuple(sorted(r.renda.tipos_com_grao)),
                nota_sem_grao=r.renda.nota_sem_grao,
            ),
            agua=AguaRegra(
                sede_pouca_ate_mm=r.agua.sede_pouca_ate_mm,
                sede_muita_desde_mm=r.agua.sede_muita_desde_mm,
                percentil_seco=r.agua.percentil_seco,
            ),
            rotacao=RotacaoRegra(
                bonus_diversidade_2=r.rotacao.bonus_diversidade_2,
                bonus_diversidade_3=r.rotacao.bonus_diversidade_3,
                max_pousios=r.rotacao.max_pousios,
                culturas_supressoras_nematoide=tuple(
                    sorted(r.rotacao.culturas_supressoras_nematoide)
                ),
            ),
            plano_b=PlanoBRegra(
                dias_antes_semeadura=r.plano_b.dias_antes_semeadura,
                anos_falha_min=r.plano_b.anos_falha_min,
                sensibilidade_min_pct=r.plano_b.sensibilidade_min_pct,
                precisao_min_pct=r.plano_b.precisao_min_pct,
                chance_max_pct=r.plano_b.chance_max_pct,
            ),
            alertas=AlertasRegra(
                geada_temp_c=r.alertas_area.geada_temp_c,
                geada_inicio=r.alertas_area.geada_inicio,
                geada_fim=r.alertas_area.geada_fim,
                chuva_forte_mm=r.alertas_area.chuva_forte_mm,
                chuva_forte_inicio=r.alertas_area.chuva_forte_inicio,
                chuva_forte_fim=r.alertas_area.chuva_forte_fim,
                fogo_raio_km=r.alertas_area.fogo_raio_km,
            ),
            avisos=AvisosRegra(
                terra_seca_percentil_max=r.avisos_tela.terra_seca_percentil_max,
                dias_sem_chuva_min=r.avisos_tela.dias_sem_chuva_min,
                calor_dias_min=r.avisos_tela.calor_dias_min,
                calor_janela_dias=r.avisos_tela.calor_janela_dias,
                vizinhos_dias=r.avisos_tela.vizinhos_dias,
                raio_km=r.comunidade.raio_km,
            ),
            sinal=SinalRegra(
                estacao_previsao=r.sinal_enso.estacao_previsao,
                fase_chance_min_pct=r.sinal_enso.fase_chance_min_pct,
                anos_fase_min=r.sinal_enso.anos_fase_min,
                anos_ruins_seco_pct=_pct(r.sinal_enso.fracao_anos_ruins_seco),
            ),
            fontes=dict(r.fontes_metodo),
        )
