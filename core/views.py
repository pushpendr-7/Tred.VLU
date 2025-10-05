from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseBadRequest
from django.utils import timezone
from .forms import RegisterForm, LoginForm, ItemForm, BidForm
from .models import Item, Bid, Payment, Block
from .services import append_block, try_activate_auction


def home(request):
    items = Item.objects.all().order_by('-created_at')
    return render(request, 'home.html', {'items': items})


def register_view(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            login(request, user)
            append_block('USER_REGISTERED', {'user_id': user.id, 'username': user.username})
            return redirect('home')
    else:
        form = RegisterForm()
    return render(request, 'register.html', {'form': form})


def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            user = authenticate(request, username=form.cleaned_data['username'], password=form.cleaned_data['password'])
            if user is not None:
                login(request, user)
                append_block('USER_LOGGED_IN', {'user_id': user.id})
                return redirect('home')
            return render(request, 'login.html', {'form': form, 'error': 'Invalid credentials'})
    else:
        form = LoginForm()
    return render(request, 'login.html', {'form': form})


def logout_view(request):
    if request.user.is_authenticated:
        append_block('USER_LOGGED_OUT', {'user_id': request.user.id})
    logout(request)
    return redirect('home')


@login_required
def item_create(request):
    if request.method == 'POST':
        form = ItemForm(request.POST, request.FILES)
        if form.is_valid():
            item = form.save(commit=False)
            item.owner = request.user
            item.save()
            append_block('ITEM_CREATED', {'item_id': item.id, 'owner_id': request.user.id})
            return redirect('item_detail', item_id=item.id)
    else:
        form = ItemForm()
    return render(request, 'item_form.html', {'form': form})


def item_list(request):
    items = Item.objects.all().order_by('-created_at')
    return render(request, 'item_list.html', {'items': items})


def item_detail(request, item_id):
    item = get_object_or_404(Item, id=item_id)
    bids = item.bids.select_related('user').all()
    top_bid = item.bids.order_by('-amount').first()
    is_top_bidder = bool(top_bid and request.user.is_authenticated and top_bid.user_id == request.user.id)
    bid_form = BidForm()
    return render(request, 'item_detail.html', {
        'item': item,
        'bids': bids,
        'bid_form': bid_form,
        'is_top_bidder': is_top_bidder,
        'top_bid': top_bid,
    })


@login_required
def place_bid(request, item_id):
    item = get_object_or_404(Item, id=item_id)
    if request.method != 'POST':
        return HttpResponseBadRequest('Invalid')
    form = BidForm(request.POST)
    if not form.is_valid():
        return render(request, 'item_detail.html', {'item': item, 'bids': item.bids.all(), 'bid_form': form, 'error': 'Invalid bid'})

    amount = form.cleaned_data['amount']
    # Ensure auction is active only after 2+ unique bidders
    top_bid = item.bids.order_by('-amount').first()
    min_required = item.start_price if top_bid is None else max(top_bid.amount, item.start_price)
    if amount <= min_required:
        return render(request, 'item_detail.html', {'item': item, 'bids': item.bids.all(), 'bid_form': form, 'error': f'Bid must be greater than {min_required}'})

    bid = Bid.objects.create(item=item, user=request.user, amount=amount)
    append_block('BID_PLACED', {'item_id': item.id, 'user_id': request.user.id, 'amount': str(amount)})
    try_activate_auction(item)
    return redirect('item_detail', item_id=item.id)


@login_required
def start_payment(request, item_id):
    item = get_object_or_404(Item, id=item_id)
    top_bid = item.bids.order_by('-amount').first()
    if not top_bid or top_bid.user_id != request.user.id:
        return HttpResponseBadRequest('Only highest bidder can pay')
    # For demo, render a page with Google Pay test button
    return render(request, 'pay.html', {'item': item, 'amount': top_bid.amount})


@login_required
def payment_callback(request, item_id):
    item = get_object_or_404(Item, id=item_id)
    if request.method != 'POST':
        return HttpResponseBadRequest('Invalid')
    # In real app, verify payment token with gateway
    Payment.objects.create(
        item=item,
        buyer=request.user,
        amount=item.bids.order_by('-amount').first().amount,
        provider='GooglePayTest',
        status='success',
        raw_json=request.POST.dict(),
    )
    append_block('PAYMENT_RECORDED', {'item_id': item.id, 'buyer_id': request.user.id})
    return redirect('item_detail', item_id=item.id)


def chain_view(request):
    blocks = Block.objects.all().order_by('index')
    return render(request, 'chain.html', {'blocks': blocks})
