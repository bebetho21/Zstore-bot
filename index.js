require("dotenv").config()
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

const fs = require("fs");
const path = require("path");

const PRODUTOS_PATH = path.join(__dirname, "produtos.json");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const CARGO_ADMIN_ID = "1464846406450942065";
const CARGO_STAFF_ID = "1464846409139359784";

const PIX_CHAVE = "SUA_CHAVE_PIX_AQUI";

let produtos = {};
let ticketCounter = 0;

if (fs.existsSync(PRODUTOS_PATH)) {
produtos = JSON.parse(fs.readFileSync(PRODUTOS_PATH, "utf8"));
}

function salvarProdutos() {
fs.writeFileSync(PRODUTOS_PATH, JSON.stringify(produtos, null, 2));
}

client.once("clientReady", () => {
console.log(`✅ Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

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
const planosTexto = await perguntar("💰 Planos (um por linha):\nEx:\n100 seguidores | R$5\n500 seguidores | R$20");

const planos = planosTexto.split("\n").map((linha, index) => {
return {
label: linha.split("|")[0].trim(),
description: linha.split("|")[1].trim(),
value: `plano_${Date.now()}_${index}`
};
});

produtos[nome] = {
nome,
descricao,
imagem,
planos
};

salvarProdutos();

message.channel.send("✅ Produto criado e salvo!");
}

if (message.content === "!enviarproduto") {

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

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

message.channel.send({ content: "📦 Selecione o produto:", components: [row] });
}

});

client.on("interactionCreate", async (interaction) => {

if (interaction.isStringSelectMenu()) {

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
{ id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
{ id: CARGO_ADMIN_ID, allow: [PermissionsBitField.Flags.ViewChannel] },
{ id: CARGO_STAFF_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
]
});

const embed = new EmbedBuilder()
.setTitle("💳 Pagamento via PIX")
.setDescription(
`👤 Cliente: ${interaction.user}
📦 Produto: ${produto.nome}
💰 Plano: ${plano.label}

🔑 Chave PIX:
\`${PIX_CHAVE}\`

📩 Envie o comprovante aqui para finalizar.`
)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("fechar_ticket")
.setLabel("🔒 Fechar Ticket")
.setStyle(ButtonStyle.Danger)
);

await canalTicket.send({
content: `<@&${CARGO_ADMIN_ID}> <@&${CARGO_STAFF_ID}>`,
embeds: [embed],
components: [row]
});

await interaction.reply({
content: "✅ Ticket criado!",
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

await canal.send({ embeds: [embed], components: [row] });

await interaction.update({
content: "✅ Produto enviado!",
components: []
});
}

if (interaction.isButton()) {

if (interaction.customId === "fechar_ticket") {

if (
!interaction.member.roles.cache.has(CARGO_ADMIN_ID) &&
!interaction.member.roles.cache.has(CARGO_STAFF_ID)
)
return interaction.reply({ content: "❌ Apenas staff/admin.", ephemeral: true });

await interaction.reply({ content: "🔒 Fechando...", ephemeral: true });

setTimeout(() => {
interaction.channel.delete();
}, 2000);
}
}
});

client.login(process.env.TOKEN);