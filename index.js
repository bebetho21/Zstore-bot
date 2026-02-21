require("dotenv").config();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "!";
const PRODUTOS_PATH = "./produtos.json";

function carregarProdutos() {
  if (!fs.existsSync(PRODUTOS_PATH)) {
    fs.writeFileSync(PRODUTOS_PATH, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(PRODUTOS_PATH));
}

function salvarProdutos(produtos) {
  fs.writeFileSync(PRODUTOS_PATH, JSON.stringify(produtos, null, 2));
}

client.once("ready", () => {
  console.log(`🔥 ZStore Online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const comando = args.shift().toLowerCase();
  const produtos = carregarProdutos();

  // 🔐 Apenas admin
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ Apenas administradores podem usar comandos.");
  }

  // 📦 CRIAR PRODUTO
  if (comando === "criarproduto") {
    const id = args[0];
    if (!id) return message.reply("Informe um ID.");

    if (produtos[id]) return message.reply("Produto já existe.");

    produtos[id] = {
      nome: "Novo Produto",
      descricao: "Descrição aqui",
      imagem: null,
      opcoes: []
    };

    salvarProdutos(produtos);
    return message.reply(`✅ Produto ${id} criado.`);
  }

  // ➕ ADD OPÇÃO
  if (comando === "addopcao") {
    const id = args[0];
    const label = args[1];
    const duracao = args[2];
    const preco = args[3];

    if (!produtos[id]) return message.reply("Produto não existe.");

    produtos[id].opcoes.push({
      label: label.replace(/_/g, " "),
      descricao: duracao.replace(/_/g, " "),
      preco: preco,
      value: label.toLowerCase()
    });

    salvarProdutos(produtos);
    return message.reply("✅ Opção adicionada.");
  }

  // 🗑️ DELETAR PRODUTO
  if (comando === "deletarproduto") {
    const id = args[0];
    if (!produtos[id]) return message.reply("Produto não existe.");

    delete produtos[id];
    salvarProdutos(produtos);
    return message.reply("🗑️ Produto deletado.");
  }

  // 📤 ENVIAR PRODUTO
  if (comando === "enviarproduto") {
    const id = args[0];
    if (!produtos[id]) return message.reply("Produto não existe.");

    const produto = produtos[id];

    const embed = new EmbedBuilder()
      .setTitle(produto.nome)
      .setDescription(produto.descricao)
      .setColor("#2B2D31")
      .setImage(produto.imagem);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`select_${id}`)
      .setPlaceholder("🛒 Escolha o plano");

    produto.opcoes.forEach(op => {
      select.addOptions({
        label: op.label,
        description: `${op.descricao} • 💰 ${op.preco}`,
        value: op.value
      });
    });

    const row = new ActionRowBuilder().addComponents(select);

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

client.on("interactionCreate", async (interaction) => {

  // 📌 SELECT MENU
  if (interaction.isStringSelectMenu()) {
    const produtoId = interaction.customId.split("_")[1];
    const produtos = carregarProdutos();
    const produto = produtos[produtoId];

    const opcao = produto.opcoes.find(
      op => op.value === interaction.values[0]
    );

    const botao = new ButtonBuilder()
      .setCustomId(`comprar_${produtoId}_${opcao.value}`)
      .setLabel("🛒 Comprar")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(botao);

    return interaction.reply({
      content: `Plano: **${opcao.label}**\nPreço: **${opcao.preco}**`,
      components: [row],
      ephemeral: true
    });
  }

  // 🛒 BOTÃO COMPRAR
  if (interaction.isButton()) {

    if (interaction.customId.startsWith("comprar_")) {

      const partes = interaction.customId.split("_");
      const produtoId = partes[1];
      const opcaoValue = partes[2];

      const produtos = carregarProdutos();
      const produto = produtos[produtoId];
      const opcao = produto.opcoes.find(o => o.value === opcaoValue);

      const canal = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      const fechar = new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("🔒 Fechar Ticket")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(fechar);

      canal.send({
        content: `🎟️ ${interaction.user}\nProduto: **${produto.nome}**\nPlano: **${opcao.label}**\nPreço: **${opcao.preco}**`,
        components: [row]
      });

      return interaction.reply({
        content: `✅ Ticket criado: ${canal}`,
        ephemeral: true
      });
    }

    if (interaction.customId === "fechar_ticket") {
      await interaction.reply("🔒 Fechando ticket...");
      setTimeout(() => interaction.channel.delete(), 3000);
    }
  }
});

client.login(process.env.TOKEN);