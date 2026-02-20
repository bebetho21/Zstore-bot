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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const CARGO_ADMIN_ID = "1464846406450942065";
const CARGO_STAFF_ID = "1464846409139359784";

let produtos = {};
let ticketCounter = 0;

let pagamentoPix = {
  titulo: "Pagamento via Pix",
  qr: "",
  chave: ""
};

let embedsPagamentoTicket = {};
let donosTicket = {};

/* ================= READY ================= */

client.once("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

/* ================= MENSAGENS ================= */

client.on("messageCreate", async (message) => {

if (message.author.bot) return;

/* ================= COMANDOS ================= */

if (message.content === "!comandosbot") {

const embed = new EmbedBuilder()
.setTitle("📜 Comandos do Bot")
.setDescription(`
🛠️ Admin:
!criarproduto
!enviarproduto

💳 Pagamento:
!chave
!confirmado

📋 Sistema:
!comandosbot
`)
.setColor("Blue");

message.channel.send({embeds:[embed]});
}

/* ================= CRIAR PRODUTO ================= */

if (message.content === "!criarproduto") {

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin");

const perguntar = async (pergunta) => {
await message.channel.send(pergunta);
const filtro = m => m.author.id === message.author.id;
const coletado = await message.channel.awaitMessages({filter:filtro,max:1});
return coletado.first().content;
};

const nome = await perguntar("📦 Nome do produto:");
const descricao = await perguntar("📝 Descrição:");
const imagem = await perguntar("🖼️ URL da imagem:");
const estoque = await perguntar("📦 Quantidade em estoque:");

const planosTexto = await perguntar("💰 Planos (um por linha):");

const planos = planosTexto.split("\n").map((linha,index)=>{
return {
label: linha.split("|")[0].trim(),
description: linha.split("|").slice(1).join("|").trim(),
value:`plano_${Date.now()}_${index}`
};
});

produtos[nome] = {
nome,
descricao,
imagem,
estoque,
planos
};

message.channel.send("✅ Produto criado!");
}

/* ================= ENVIAR PRODUTO ================= */

if (message.content === "!enviarproduto") {

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return;

const menu = new StringSelectMenuBuilder()
.setCustomId("selecionar_produto")
.setPlaceholder("📦 Escolha o produto")
.setMinValues(1)
.setMaxValues(5)
.addOptions(
Object.values(produtos).map(prod=>({
label: prod.nome,
description:`Estoque: ${prod.estoque}`,
value: prod.nome
}))
);

const row = new ActionRowBuilder().addComponents(menu);

message.channel.send({
content:"📦 Escolha:",
components:[row]
});
}

/* ================= CHAVE PIX ================= */

if (message.content === "!chave") {

if (!message.channel.name.includes("ticket-"))
return;

const embed = new EmbedBuilder()
.setTitle(pagamentoPix.titulo)
.setDescription(`💰 Pix:\n\`\`\`\n${pagamentoPix.chave}\n\`\`\``)
.setImage(pagamentoPix.qr)
.setColor("Yellow");

const msg = await message.channel.send({embeds:[embed]});
embedsPagamentoTicket[message.channel.id] = msg.id;
}

/* ================= CONFIRMADO ================= */

if (message.content === "!confirmado") {

const dono = donosTicket[message.channel.id];

if (
message.author.id !== dono &&
!message.member.roles.cache.has(CARGO_ADMIN_ID) &&
!message.member.roles.cache.has(CARGO_STAFF_ID)
)return;

const msgId = embedsPagamentoTicket[message.channel.id];
if(!msgId)return;

const msg = await message.channel.messages.fetch(msgId);
if(msg) await msg.delete();
}

});

/* ================= INTERAÇÕES ================= */

client.on("interactionCreate", async (interaction)=>{

if(interaction.isStringSelectMenu()){

if(interaction.customId === "selecionar_produto"){

for(const produtoNome of interaction.values){

const produto = produtos[produtoNome];

ticketCounter++;

const canalTicket = await interaction.guild.channels.create({
name:`🛒・ticket-${ticketCounter}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]
},
{
id:CARGO_ADMIN_ID,
allow:[PermissionsBitField.Flags.ViewChannel]
},
{
id:CARGO_STAFF_ID,
allow:[PermissionsBitField.Flags.ViewChannel]
}
]
});

donosTicket[canalTicket.id] = interaction.user.id;

const embed = new EmbedBuilder()
.setTitle("🛒 Pedido Criado")
.setDescription(`Produto: ${produto.nome}\nEstoque: ${produto.estoque}`)
.setColor("Green");

const rowTicket = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setLabel("🔗 Ir para o Ticket")
.setStyle(ButtonStyle.Link)
.setURL(`https://discord.com/channels/${interaction.guild.id}/${canalTicket.id}`),

new ButtonBuilder()
.setCustomId("fechar_ticket")
.setLabel("🔒 Fechar Ticket")
.setStyle(ButtonStyle.Danger)
);

await canalTicket.send({
content:`📢 ${interaction.user}`,
embeds:[embed],
components:[rowTicket]
});
}

interaction.reply({content:"✅ Ticket criado!",ephemeral:true});
}
}

if(interaction.isButton()){

if(interaction.customId === "fechar_ticket"){

const dono = donosTicket[interaction.channel.id];

if(
interaction.user.id !== dono &&
!interaction.member.roles.cache.has(CARGO_ADMIN_ID) &&
!interaction.member.roles.cache.has(CARGO_STAFF_ID)
){
return interaction.reply({content:"❌ Apenas dono ou staff",ephemeral:true});
}

await interaction.reply({content:"🔒 Fechando...",ephemeral:true});
setTimeout(()=>{interaction.channel.delete()},2000);
}
}
});

client.login(TOKEN);