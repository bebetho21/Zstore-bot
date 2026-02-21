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
  ChannelSelectMenuBuilder,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";
const produtosFile = "./produtos.json";

if (!fs.existsSync(produtosFile)) {
  fs.writeFileSync(produtosFile, JSON.stringify({}));
}

function loadProdutos() {
  return JSON.parse(fs.readFileSync(produtosFile));
}

function saveProdutos(data) {
  fs.writeFileSync(produtosFile, JSON.stringify(data, null, 2));
}

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const produtos = loadProdutos();

  // ================= COMANDOS =================

  if (command === "comandos") {
    return message.reply(`
📦 **Comandos do Bot**
!criarproduto
!addopcao <id> <nome> <duracao> <preco>
!deletarproduto <id>
!enviarproduto <id>
!comandos
    `);
  }

  // ================= CRIAR PRODUTO =================

  if (command === "criarproduto") {
    const id = `produto_${Date.now()}`;

    produtos[id] = {
      titulo: "Novo Produto",
      descricao: "Edite depois com !addopcao",
      imagem: "",
      canal: null,
      opcoes: []
    };

    saveProdutos(produtos);

    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`canal_${id}`)
      .setPlaceholder("Selecione o canal para publicar")
      .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(menu);

    await message.reply({
      content: `✅ Produto criado com ID: **${id}**\nAgora selecione o canal para publicar.`,
      components: [row]
    });
  }

  // ================= ADD OPÇÃO =================

  if (command === "addopcao") {
    const [id, nome, duracao, preco] = args;
    if (!produtos[id]) return message.reply("❌ Produto não encontrado.");

    produtos[id].opcoes.push({ nome, duracao, preco });
    saveProdutos(produtos);

    return message.reply("✅ Opção adicionada com sucesso.");
  }

  // ================= DELETAR =================

  if (command === "deletarproduto") {
    const id = args[0];
    if (!produtos[id]) return message.reply("❌ Produto não encontrado.");

    delete produtos[id];
    saveProdutos(produtos);

    return message.reply("🗑 Produto deletado.");
  }

  // ================= ENVIAR PRODUTO =================

  if (command === "enviarproduto") {
    const id = args[0];
    if (!produtos[id]) return message.reply("❌ Produto não encontrado.");
    if (!produtos[id].canal) return message.reply("❌ Escolha o canal primeiro.");

    const canal = message.guild.channels.cache.get(produtos[id].canal);
    if (!canal) return message.reply("❌ Canal inválido.");

    const embed = new EmbedBuilder()
      .setTitle(produtos[id].titulo)
      .setDescription(produtos[id].descricao)
      .setColor("Blue")
      .setImage(produtos[id].imagem || null);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`comprar_${id}`)
      .setPlaceholder("🛒 Escolha o plano");

    produtos[id].opcoes.forEach((op, i) => {
      select.addOptions({
        label: op.nome,
        description: `${op.duracao} • R$${op.preco}`,
        value: `${i}`
      });
    });

    const row = new ActionRowBuilder().addComponents(select);

    canal.send({ embeds: [embed], components: [row] });

    return message.reply("📤 Produto enviado.");
  }
});

// ================= INTERAÇÕES =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isButton()) return;

  const produtos = loadProdutos();

  // Selecionar canal
  if (interaction.customId.startsWith("canal_")) {
    const id = interaction.customId.replace("canal_", "");
    produtos[id].canal = interaction.values[0];
    saveProdutos(produtos);

    return interaction.reply({ content: "✅ Canal salvo.", ephemeral: true });
  }

  // Compra
  if (interaction.customId.startsWith("comprar_")) {
    const id = interaction.customId.replace("comprar_", "");
    const opcao = produtos[id].opcoes[interaction.values[0]];

    const avaliarRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("star_1").setLabel("⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_2").setLabel("⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_3").setLabel("⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_4").setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      content: `✅ Compra simulada de **${opcao.nome}**.\nAvalie sua experiência:`,
      components: [avaliarRow],
      ephemeral: true
    });
  }

  // Avaliação
  if (interaction.customId.startsWith("star_")) {
    const estrelas = interaction.customId.replace("star_", "");
    const canalAval = interaction.guild.channels.cache.get("1464846455218114683");

    if (!canalAval) return interaction.reply({ content: "❌ Canal #avaliacoes não encontrado.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("⭐ Nova Avaliação")
      .setDescription(`Usuário: ${interaction.user}\nNota: ${"⭐".repeat(estrelas)}`)
      .setColor("Gold")
      .setTimestamp();

    canalAval.send({ embeds: [embed] });

    return interaction.reply({ content: "✅ Avaliação enviada com sucesso!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);