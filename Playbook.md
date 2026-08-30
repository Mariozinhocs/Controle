MIGAPA-PLAY-001 — Playbook de Planejamento, Execução, Verificação e Evolução do Squad A-Team

1. Finalidade
Este manual estabelece as diretrizes de governança, arquitetura, qualidade e operação para as entregas de software do squad A-Team. O objetivo é assegurar o desenvolvimento ágil e incremental, mitigando o risco de regressões e perda de integridade dos dados.

2. O Squad A-Team
O squad opera em modelo de cooperação híbrido homem-máquina:
- PO (Product Owner - Mario): Responsável pela priorização do backlog, validações reais e direcionamento de negócio.
- Agent (Engenheiro de Software IA - Antigravity): Responsável pelo diagnóstico técnico, codificação, testes, automação e deploys sob a governança deste playbook.

3. Princípios Operacionais do A-Team
- Valor antes de documentação: Entregas rápidas de código funcional;
- Produto acima de projeto temporário: Código limpo, extensível e documentado;
- Diagnóstico antes de patch: Investigação rigorosa e identificação das causas raiz de bugs antes de aplicar correções;
- Incrementos pequenos e verificáveis: Evitar grandes pacotes de mudanças difíceis de rastrear;
- Verificação precede progressão: Nenhum incremento avança ou é publicado sem antes passar pelo crivo dos testes e validação de regressão.

4. Resolução de Conflitos e Persistência Híbrida (Sync)
Para sistemas com persistência local (Offline-First) e banco de dados centralizado:
- Sincronização LWW (Last-Write-Wins): Conflitos entre dados locais e dados remotos são resolvidos comparando a data exata de modificação (`updatedAt`) gerada no cliente. A versão com o timestamp mais recente sempre prevalecerá.
- Fila de Ações Pendentes: Operações de escrita ou exclusão realizadas localmente sem conexão de internet (ou sob falha de requisição) devem ser enfileiradas e persistidas localmente em estado "não-sincronizado". A replicação deve ser tentada na inicialização do app e após o restabelecimento da conectividade.
- Cascateamento Seguro: A leitura inicial de dados do servidor não deve sobrescrever modificações locais não-sincronizadas. O merge deve ser feito item por item, respeitando o timestamp e o estado de pendência.

5. Regras para Migrações de Banco de Dados (Expand & Contract)
Para evitar interrupção de serviços e garantir a viabilidade de rollbacks sem perda de dados:
- Fase Expand (Expandir): Alterações de banco de dados devem ser aditivas (adicionar novas colunas, novas tabelas ou índices) de forma retrocompatível. O código antigo deve continuar funcionando perfeitamente com o banco expandido.
- Fase Contract (Contrair): Depreciações e remoções de colunas ou tabelas antigas só devem ser executadas em scripts separados após a nova versão do software estar 100% homologada e estável em produção.
- Proibição de Modificação de Dados em Lote no Boot: Scripts de inicialização automática de tabelas (ex: db_installer) não podem resetar senhas ou modificar dados cadastrais de usuários ativos globais sem a intenção explícita do administrador.

6. Qualidade e Testes de Regressão Obrigatórios
- Prevenção de Regressão: Toda tarefa concluída deve ser validada contra regressões nos fluxos críticos associados àquela mudança.
- Esteira de Deploy Automatizada: Para deploys de risco médio ou alto, a execução de testes automatizados ou scripts de validação de rotas deve ser integrada ao fluxo de deploy. A detecção de qualquer falha de integridade deve suspender o processo de deploy imediatamente.
- Evidências na Execução: Cada tarefa deve registrar logs de auditoria claros na trilha de auditoria do sistema, indicando o responsável e o timestamp da validação.

7. Otimização de Custos e Usabilidade de Recursos de IA
Para implementações contendo inteligência artificial:
- Cache de Prompts e Respostas: Para evitar latência e custos excessivos, requisições repetitivas de IA devem ser cacheadas no cliente ou no servidor sempre que possível.
- Feedback Visual Imediato: Processamentos de IA demorados devem fornecer feedback imediato de progresso e carregamento para a interface do usuário (UX fluida).
- Fallback Offline: Caso a API de inteligência artificial esteja indisponível, o sistema deve fornecer um mecanismo alternativo leve e funcional local para o usuário final.

8. Processo de Execução Incremental (Marcos do A-Team)
M1: Enquadramento e Alinhamento (PO define a meta ou reporta a falha).
M2: Diagnóstico e Planejamento (Agent elabora o plano de implementação detalhado).
M3: Aprovação do Plano (PO analisa e concede aprovação).
M4: Desenvolvimento e Testes (Agent executa mudanças pequenas, marcando progresso no task.md).
M5: Ciclo CVCC e Auditoria (Agent reproduz correções, valida contra regressões e documenta evidências).
M6: Homologação (Deploy para o ambiente de testes e validação real do PO).
M7: Produção e Lições Aprendidas (Deploy final e atualização do project_memory.md).

9. Histórico de Versões do Playbook
Versão  Data        Alteração
1.0     15/08/2026  Criação do Playbook operacional de homologação.
2.0     15/08/2026  Revisão integral para governança proporcional e ciclo CVCC.
3.0     19/08/2026  Customização para o Squad A-Team. Adição das regras Expand & Contract, sincronização reativa LWW, testes pré-deploy e cache/fallback de IA.

Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
"si vis pacem para bellum"
