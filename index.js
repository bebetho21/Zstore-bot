require("dotenv").config();
const fs = require("fs");
const path = require("path");

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
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const PRODUTOS_PATH = path.join(__dirname,"produtos.json");
const PIX_PATH = path.join(__dirname,"pix.json");
const COUNTER_PATH = path.join(__dirname,"counter.json");

const CARGO_ADMIN_ID="1464846406450942065";
const CARGO_STAFF_ID="1464846409139359784";

let produtos={};
let pixData={};
let ticketCounter=0;

/* ================= CARREGAR ================= */

function carregarProdutos(){
if(!fs.existsSync(PRODUTOS_PATH))
fs.writeFileSync(PRODUTOS_PATH,JSON.stringify({},null,2));

try{
produtos=JSON.parse(fs.readFileSync(PRODUTOS_PATH,"utf8"));
}catch{
produtos={};
}
}

function salvarProdutos(){
fs.writeFileSync(PRODUTOS_PATH,JSON.stringify(produtos,null,2));
}

function carregarPix(){
if(!fs.existsSync(PIX_PATH))
fs.writeFileSync(PIX_PATH,JSON.stringify({},null,2));

try{
pixData=JSON.parse(fs.readFileSync(PIX_PATH,"utf8"));
}catch{
pixData={};
}
}

function salvarPix(){
fs.writeFileSync(PIX_PATH,JSON.stringify(pixData,null,2));
}

function carregarCounter(){
if(!fs.existsSync(COUNTER_PATH))
fs.writeFileSync(COUNTER_PATH,JSON.stringify({counter:0},null,2));

ticketCounter=JSON.parse(fs.readFileSync(COUNTER_PATH)).counter;
}

function salvarCounter(){
fs.writeFileSync(COUNTER_PATH,JSON.stringify({counter:ticketCounter},null,2));
}

/* ================= READY ================= */

client.once("clientReady",()=>{
console.log(`✅ Online: ${client.user.tag}`);
});

/* CARREGA AO INICIAR */
carregarProdutos();
carregarPix();
carregarCounter();

/* ================= COMANDOS ================= */

client.on("messageCreate",async(message)=>{

if(message.author.bot) return;

/* COMANDOS */

if(message.content==="!comandoszstore"){

const embed=new EmbedBuilder()
.setTitle("📜 Comandos ZStore")
.setDescription(`
!criarproduto - Criar produto
!enviarproduto - Enviar produto no canal
!pagamento - Mostrar PIX
!cadastrarchave - Cadastrar PIX
!comandoszstore - Ver comandos
`)
.setColor("Blue");

return message.channel.send({embeds:[embed]});
}

/* PIX */

if(message.content==="!cadastrarchave"){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin.");

const filter=m=>m.author.id===message.author.id;

await message.channel.send("Título:");
const titulo=(await message.channel.awaitMessages({filter,max:1,time:60000})).first();

await message.channel.send("Chave PIX:");
const chave=(await message.channel.awaitMessages({filter,max:1,time:60000})).first();

await message.channel.send("URL QR Code:");
const qr=(await message.channel.awaitMessages({filter,max:1,time:60000})).first();

pixData={titulo:titulo.content,chave:chave.content,qr:qr.content};
salvarPix();

return message.channel.send("✅ PIX salvo!");
}

/* PAGAMENTO */

if(message.content==="!pagamento"){

if(!pixData.titulo)
return message.reply("❌ Nenhum PIX cadastrado.");

const embed=new EmbedBuilder()
.setTitle(pixData.titulo)
.setDescription(`🔑 Chave PIX:\n${pixData.chave}`)
.setImage(pixData.qr)
.setColor("Green");

return message.channel.send({embeds:[embed]});
}

/* CRIAR PRODUTO */

if(message.content==="!criarproduto"){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin.");

const filter=m=>m.author.id===message.author.id;

await message.channel.send("Nome:");
const nome=(await message.channel.awaitMessages({filter,max:1})).first().content;

await message.channel.send("Descrição:");
const descricao=(await message.channel.awaitMessages({filter,max:1})).first().content;

await message.channel.send("URL Imagem:");
const imagem=(await message.channel.awaitMessages({filter,max:1})).first().content;

await message.channel.send("Planos (1 por linha):");
const planosTexto=(await message.channel.awaitMessages({filter,max:1})).first().content;

const planos=planosTexto.split("\n").map((l,i)=>({
label:l.split("|")[0].trim(),
description:l.split("|").slice(1).join("|").trim(),
value:`plano_${Date.now()}_${i}`
}));

produtos[nome]={nome,descricao,imagem,planos};
salvarProdutos();

return message.channel.send("✅ Produto salvo!");
}

/* ENVIAR PRODUTO */

if(message.content==="!enviarproduto"){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return;

if(Object.keys(produtos).length===0)
return message.reply("❌ Nenhum produto.");

const menu=new StringSelectMenuBuilder()
.setCustomId("selecionar_produto")
.setPlaceholder("Escolha")
.addOptions(
Object.values(produtos).map(p=>({
label:p.nome,
description:p.descricao.slice(0,100),
value:p.nome
}))
);

return message.channel.send({
content:"📦 Selecione:",
components:[new ActionRowBuilder().addComponents(menu)]
});
}

});

/* ================= INTERAÇÕES ================= */

client.on("interactionCreate",async(interaction)=>{

if(interaction.isStringSelectMenu()){

if(interaction.customId==="selecionar_produto"){

const produto=produtos[interaction.values[0]];

const menuCanal=new ChannelSelectMenuBuilder()
.setCustomId(`selecionar_canal_${produto.nome}`)
.addChannelTypes(ChannelType.GuildText);

return interaction.reply({
content:`Enviar ${produto.nome} em qual canal?`,
components:[new ActionRowBuilder().addComponents(menuCanal)],
ephemeral:true
});
}

if(interaction.customId.startsWith("menu_compra_")){

const nomeProduto=interaction.customId.replace("menu_compra_","");
const produto=produtos[nomeProduto];
const plano=produto.planos.find(p=>p.value===interaction.values[0]);

ticketCounter++;
salvarCounter();

const canalTicket=await interaction.guild.channels.create({
name:`ticket-${ticketCounter}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},
{id:CARGO_ADMIN_ID,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},
{id:CARGO_STAFF_ID,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]}
]
});

const embed=new EmbedBuilder()
.setTitle("🛒 Pedido")
.setDescription(`👤 ${interaction.user}\n📦 ${produto.nome}\n💰 ${plano.label}`)
.setColor("Green");

await canalTicket.send({embeds:[embed]});

return interaction.reply({content:"✅ Ticket criado!",ephemeral:true});
}

}

if(interaction.isChannelSelectMenu()){

const nomeProduto=interaction.customId.replace("selecionar_canal_","");
const produto=produtos[nomeProduto];
const canal=interaction.guild.channels.cache.get(interaction.values[0]);

const embed=new EmbedBuilder()
.setTitle(produto.nome)
.setDescription(produto.descricao)
.setImage(produto.imagem)
.setColor("Blue");

const menuCompra=new StringSelectMenuBuilder()
.setCustomId(`menu_compra_${produto.nome}`)
.addOptions(produto.planos.map(p=>({
label:p.label,
description:p.description.slice(0,100),
value:p.value
})));

await canal.send({
embeds:[embed],
components:[new ActionRowBuilder().addComponents(menuCompra)]
});

return interaction.update({content:"✅ Enviado!",components:[]});
}

});

client.login(process.env.TOKEN);