# ⚽ futAgenda

**Sua agenda de futebol diária, direto ao ponto.** O **futAgenda** é uma aplicação web minimalista e rápida projetada para fãs de futebol que querem saber uma única coisa: **quem vai jogar hoje e onde vai passar?** Sem anúncios intrusivos ou menus confusos, apenas a lista de partidas, placares ao vivo e os canais de transmissão.

---

## ✨ Funcionalidades

* 📺 **Onde Assistir:** Indicação clara de quais canais de TV (aberta ou fechada) e serviços de streaming estão transmitindo cada partida.
* 📅 **Navegação Diária:** Veja os jogos de hoje, amanhã e dos próximos 7 dias com uma navegação simples e intuitiva.
* 🔍 **Busca Inteligente:** Filtre rapidamente as partidas digitando o nome do seu time do coração ou da competição (ex: "Flamengo", "Champions").
* 🔴 **Placares ao Vivo:** Acompanhe o status das partidas em tempo real (Não iniciado, Intervalo, Fim de jogo, Pênaltis).
* 📊 **Detalhes da Partida:** Um clique no jogo abre um modal com a linha do tempo de eventos, incluindo autores de **Gols** e **Cartões**.
* 📱 **Design Responsivo:** Interface construída com Tailwind CSS, focada na melhor experiência tanto no celular quanto no desktop.

---

## 🚀 Tecnologias Utilizadas

O projeto foi construído com foco em performance e simplicidade:

* **Front-end:** HTML5, JavaScript (Vanilla) e [Tailwind CSS](https://tailwindcss.com/) (para estilização rápida e moderna).
* **Back-end/API:** Integração via endpoints (`/api/jogos` e `/api/fixture-eventos`) que fornecem os dados das partidas, escudos, horários e canais.
* **Design Pattern:** Renderização dinâmica via DOM e uso da API de Internacionalização (`Intl.DateTimeFormat`) para tratamento de fusos horários de forma nativa.

---

## 🛠️ Como executar o projeto localmente

Como o projeto possui chamadas para uma API local (arquivos em `/api/...`), você precisará de um servidor web ou back-end para rodá-lo por completo.

1. Faça o clone do repositório:
   ```bash
   git clone [https://github.com/SEU_USUARIO/futAgenda.git](https://github.com/SEU_USUARIO/futAgenda.git)
   ```
2. Navegue até a pasta do projeto:
   ```bash
   cd futAgenda
   ```
3. Configure o back-end (certifique-se de que a rota `/api/jogos` e `/api/fixture-eventos` estejam ativas e retornando os dados corretamente).
4. Sirva o arquivo `index.html` e acesse no seu navegador.

---

## 💡 Próximos Passos (Roadmap)

- [ ] Suporte a PWA (Progressive Web App) para instalação no celular.
- [ ] Favoritar times para receber notificações.
- [ ] Adicionar modo de escalações (Line-ups) no modal de detalhes.

---
