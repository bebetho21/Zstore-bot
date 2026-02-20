require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
StringSelectMenuBuilder,
ChannelSelectMenuBuilder,
ChannelType,
PermissionsBitField
} = require("discord.js");

const PRODUTOS_PATH = path.join(__dirname, "produtos.json");
const PIX_PATH = path.join(__dirname, "pix.json");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const CARGO_ADMIN_ID = "1464846406450942065";
const CARGO_STAFF_ID = "1464846409139359784";

let produtos = {};
let pixData = {};
let ticketCounter = 0;

/* ================= FUNÇÃO PRA REMOVER EMOJI ================= */

function idSeguro(nome){
return nome.replace(/[^a-zA-Z0-9]/g, "");
}

/* ================= CARREGAR ================= */

function carregarProdutos(){
if(!fs.existsSync(PRODUTOS_PATH))
fs.writeFileSync(PRODUTOS_PATH, JSON.stringify({},null,2));
produtos = JSON.parse(fs.readFileSync(PRODUTOS_PATH));
}

function carregarPix(){
if(!fs.existsSync(PIX_PATH))
fs.writeFileSync(PIX_PATH, JSON.stringify({},null,2));
pixData = JSON.parse(fs.readFileSync(PIX_PATH));
}

function salvarPix(){
fs.writeFileSync(PIX_PATH, JSON.stringify(pixData,null,2));
}

carregarProdutos();
carregarPix();

/* ================= READY ================= */

client.once("clientReady",()=>{
console.log(`✅ Bot online como ${client.user.tag}`);
});

/* ================= COMANDOS ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return;

/* PIX */

if(message.content==="!cadastrarchave"){

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin.");

const perguntar = async (p)=>{
await message.channel.send(p);
const f = m=>m.author.id===message.author.id;
const c = await message.channel.awaitMessages({filter:f,max:1});
return c.first().content;
};

pixData.titulo = await perguntar("Título:");
pixData.chave = await perguntar("Chave PIX:");
pixData.qr = await perguntar("URL QR Code:");
salvarPix();

message.channel.send("✅ PIX salvo!");
}

if(message.content==="!pagamento"){

if(!pixData.titulo) return message.reply("PIX não cadastrado");

const embed = new EmbedBuilder()
.setTitle(pixData.titulo)
.setDescription(`🔑 ${pixData.chave}`)
.setImage(pixData.qr)
.setColor("Green");

const msg = await message.channel.send({embeds:[embed]});
pixData.msgId = msg.id;
salvarPix();
}

if(message.content==="!pixconfirmado"){

if(!message.member.roles.cache.has(CARGO_ADMIN_ID) &&
!message.member.roles.cache.has(CARGO_STAFF_ID))
return;

try{
const msg = await message.channel.messages.fetch(pixData.msgId);
if(msg) await msg.delete();
}catch{}

message.channel.send("✅ Pagamento confirmado!");
}

/* ENVIAR PRODUTO */

if(message.content==="!enviarproduto"){

if(Object.keys(produtos).length===0)
return message.reply("Nenhum produto.");

const menu = new StringSelectMenuBuilder()
.setCustomId("selecionar_produto")
.setPlaceholder("Escolha o produto")
.addOptions(
Object.values(produtos).map(prod=>({
label:prod.nome,
description:prod.descricao.slice(0,100),
value:idSeguro(prod.nome)
}))
);

message.channel.send({
content:"📦 Selecione:",
components:[new ActionRowBuilder().addComponents(menu)]
});
}

});

/* ================= INTERAÇÕES ================= */

client.on("interactionCreate",async interaction=>{

if(interaction.isStringSelectMenu()){

if(interaction.customId==="selecionar_produto"){

const produto = Object.values(produtos)
.find(p=>idSeguro(p.nome)===interaction.values[0]);

const menuCanal = new ChannelSelectMenuBuilder()
.setCustomId(`canal_${idSeguro(produto.nome)}`)
.setPlaceholder("Escolha canal")
.addChannelTypes(ChannelType.GuildText);

return interaction.reply({
content:`Enviar **${produto.nome}** onde?`,
components:[new ActionRowBuilder().addComponents(menuCanal)],
ephemeral:true
});
}

if(interaction.customId.startsWith("menu_")){

const id = interaction.customId.replace("menu_","");
const produto = Object.values(produtos)
.find(p=>idSeguro(p.nome)===id);

const plano = produto.planos.find(p=>p.value===interaction.values[0]);

ticketCounter++;

const canalTicket = await interaction.guild.channels.create({
name:`ticket-${ticketCounter}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[
PermissionsBitField.Flags.ViewChannel
]
},
{
id:interaction.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles,
PermissionsBitField.Flags.EmbedLinks
]
},
{
id:CARGO_ADMIN_ID,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]
},
{
id:CARGO_STAFF_ID,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]
}
]
});

const embed = new EmbedBuilder()
.setTitle("🛒 Pedido")
.setDescription(`👤 ${interaction.user}\n📦 ${produto.nome}\n💰 ${plano.label}`)
.setColor("Green");

await canalTicket.send({
content:"Envie comprovantes, imagens ou arquivos aqui 📎",
embeds:[embed]
});

interaction.reply({content:"✅ Ticket criado!",ephemeral:true});
}

}

if(interaction.isChannelSelectMenu()){

const id = interaction.customId.replace("canal_","");
const produto = Object.values(produtos)
.find(p=>idSeguro(p.nome)===id);

const canal = interaction.guild.channels.cache.get(interaction.values[0]);

const embed = new EmbedBuilder()
.setTitle(produto.nome)
.setDescription(produto.descricao)
.setImage(produto.imagem)
.setColor("Blue");

const menuCompra = new StringSelectMenuBuilder()
.setCustomId(`menu_${idSeguro(produto.nome)}`)
.setPlaceholder("Escolha plano")
.addOptions(produto.planos.map(p=>({
label:p.label,
description:p.description.slice(0,100),
value:p.value
})));

await canal.send({
embeds:[embed],
components:[new ActionRowBuilder().addComponents(menuCompra)]
});

interaction.update({content:"✅ Produto enviado!",components:[]});
}

});

client.login(process.env.TOKEN);