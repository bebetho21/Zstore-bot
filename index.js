const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = "";
const CARGO_ADMIN_ID = "1464846406450942065";
const CARGO_STAFF_ID = "1464846409139359784";

let produtos = {};
let ticketCounter = 0;

let pagamentoPix = {
  titulo: "",
  qr: "",
  chave: ""
};

let embedsPagamentoTicket = {};

/* ================= READY ================= */

client.once("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

/* ================= MENSAGENS ================= */

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  /* ================= CRIAR PRODUTO ================= */

  if (message.content === "!criarproduto") {

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Apenas administradores.");

    const perguntar = async (pergunta) => {
      await message.channel.send(pergunta);
      const filtro = m => m.author.id === message.author.id;
      const coletado = await message.channel.awaitMessages({ filter: filtro, max: 1 });
      return coletado.first().content;
    };

    const nome = await perguntar("📦 Nome do produto:");
    const descricao = await perguntar("📝 Descrição:");
    const imagem = await perguntar("🖼️ URL da imagem:");
    const planosTexto = await perguntar("💰 Planos (um por linha):");

    const planos = planosTexto.split("\n").map((linha, index) => {
      return {
        label: linha.split("|")[0].trim(),
        description: linha.split("|").slice(1).join("|").trim(),
        value: `plano_${Date.now()}_${index}`
      };
    });

    produtos[nome] = {
      nome,
      descricao,
      imagem,
      planos
    };

    message.channel.send("✅ Produto criado com sucesso!");
  }

  /* ================= ENVIAR PRODUTO ================= */

  if (message.content === "!enviarproduto") {

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return;

    if (Object.keys(produtos).length === 0)
      return message.reply("❌ Nenhum produto criado.");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("selecionar_produto")
      .setPlaceholder("📦 Escolha o produto")
      .addOptions(
        Object.values(produtos).map(prod => ({
          label: prod.nome,
          description: prod.descricao.slice(0, 100),
          value: prod.nome
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({
      content: "📦 Selecione o produto:",
      components: [row]
    });
  }

  /* ================= CADASTRAR PIX ================= */

  if (message.content === "!cadastrarchave") {

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Apenas administradores.");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("menu_pix_config")
      .setPlaceholder("Configurar pagamento")
      .addOptions([
        { label: "Criar Título", value: "titulo" },
        { label: "Colocar Foto QR Code", value: "qr" },
        { label: "Chave Pix Copia e Cola", value: "chave" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({
      content: "⚙️ Configure o pagamento Pix:",
      components: [row]
    });
  }

  /* ================= ENVIAR PIX ================= */

  if (message.content === "!chave") {

    if (!message.channel.name.includes("ticket-"))
      return message.reply("❌ Use dentro do ticket.");

    const embed = new EmbedBuilder()
      .setTitle(pagamentoPix.titulo || "Pagamento Pix")
      .setDescription(`💰 **Chave Pix:**\n\`\`\`\n${pagamentoPix.chave}\n\`\`\``)
      .setImage(pagamentoPix.qr)
      .setColor("Yellow");

    const msg = await message.channel.send({
      embeds: [embed]
    });

    embedsPagamentoTicket[message.channel.id] = msg.id;
  }

  /* ================= CONFIRMADO ================= */

  if (message.content === "!confirmado") {

    if (!message.channel.name.includes("ticket-"))
      return;

    const msgId = embedsPagamentoTicket[message.channel.id];
    if (!msgId) return;

    const msg = await message.channel.messages.fetch(msgId);
    if (msg) await msg.delete();
  }

  /* ================= COMANDOS ================= */

  if (message.content === "!comando") {

    const embed = new EmbedBuilder()
      .setTitle("📜 Comandos do Bot")
      .setDescription(`
🛠️ **Admin**
!criarproduto
!enviarproduto
!cadastrarchave

💳 **Pagamento**
!chave
!confirmado

📋 **Sistema**
!comando
      `)
      .setColor("Blue");

    message.channel.send({ embeds: [embed] });
  }

});

/* ================= INTERAÇÕES ================= */

client.on("interactionCreate", async (interaction) => {

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "menu_pix_config") {

      const perguntar = async (pergunta) => {
        await interaction.channel.send(pergunta);
        const filtro = m => m.author.id === interaction.user.id;
        const coletado = await interaction.channel.awaitMessages({ filter: filtro, max: 1 });
        return coletado.first().content;
      };

      if (interaction.values[0] === "titulo") {
        const t = await perguntar("Digite o título:");
        pagamentoPix.titulo = t;
      }

      if (interaction.values[0] === "qr") {
        const q = await perguntar("Envie a URL da imagem do QR Code:");
        pagamentoPix.qr = q;
      }

      if (interaction.values[0] === "chave") {
        const c = await perguntar("Digite a chave Pix copia e cola:");
        pagamentoPix.chave = c;
      }

      interaction.reply({
        content: "✅ Configurado com sucesso!",
        ephemeral: true
      });
    }

    if (interaction.customId === "selecionar_produto") {

      const produto = produtos[interaction.values[0]];

      const menuCanal = new ChannelSelectMenuBuilder()
        .setCustomId(`selecionar_canal_${produto.nome}`)
        .setPlaceholder("🔎 Escolha o canal")
        .addChannelTypes(ChannelType.GuildText);

      const row = new ActionRowBuilder().addComponents(menuCanal);

      return interaction.reply({
        content: `📢 Escolha onde enviar **${produto.nome}**`,
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith("menu_compra_")) {

      const nomeProduto = interaction.customId.replace("menu_compra_", "");
      const produto = produtos[nomeProduto];
      const planoValue = interaction.values[0];
      const plano = produto.planos.find(p => p.value === planoValue);

      ticketCounter++;

      const canalTicket = await interaction.guild.channels.create({
        name: `🛒・ticket-${ticketCounter}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
          { id: CARGO_ADMIN_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
          { id: CARGO_STAFF_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("🛒 Novo Pedido Criado!")
        .setDescription(
          `👤 Cliente: ${interaction.user}\n📦 Produto: ${produto.nome}\n💰 Plano: ${plano.label}\n\nAguarde atendimento.`
        )
        .setColor("Green");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🔒 Fechar Ticket")
          .setCustomId("fechar_ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await canalTicket.send({
        content: `📢 <@&${CARGO_ADMIN_ID}> <@&${CARGO_STAFF_ID}> Novo pedido!`,
        embeds: [embed],
        components: [row]
      });

      await interaction.reply({
        content: "✅ Seu ticket foi criado!",
        ephemeral: true
      });
    }
  }

  if (interaction.isChannelSelectMenu()) {

    const nomeProduto = interaction.customId.replace("selecionar_canal_", "");
    const produto = produtos[nomeProduto];
    const canal = interaction.guild.channels.cache.get(interaction.values[0]);

    const embed = new EmbedBuilder()
      .setTitle(`🚀 ${produto.nome}`)
      .setDescription(produto.descricao)
      .setImage(produto.imagem)
      .setColor("Blue");

    const menuCompra = new StringSelectMenuBuilder()
      .setCustomId(`menu_compra_${produto.nome}`)
      .setPlaceholder("🛒 Escolha o plano")
      .addOptions(
        produto.planos.map(plano => ({
          label: plano.label,
          description: plano.description.slice(0, 100),
          value: plano.value
        }))
      );

    const row = new ActionRowBuilder().addComponents(menuCompra);

    await canal.send({
      embeds: [embed],
      components: [row]
    });

    await interaction.update({
      content: "✅ Produto enviado com sucesso!",
      components: []
    });
  }

  if (interaction.isButton()) {

    if (interaction.customId === "fechar_ticket") {

      if (
        !interaction.member.roles.cache.has(CARGO_ADMIN_ID) &&
        !interaction.member.roles.cache.has(CARGO_STAFF_ID)
      ) {
        return interaction.reply({
          content: "❌ Apenas admin ou staff podem fechar.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 Fechando ticket...",
        ephemeral: true
      });

      setTimeout(() => {
        interaction.channel.delete();
      }, 2000);
    }
  }

});

client.login(TOKEN);